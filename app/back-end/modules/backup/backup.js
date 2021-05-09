/*
 * Class used to create backups
 */

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Utils = require('./../../helpers/utils.js');
const moment = require('moment');
const archiver = require('archiver');
const tar = require('tar');
const trash = require('trash');

class Backup {
    /**
     * Loads list of backups
     *
     * @param siteName
     * @param backupsDir
     * @returns {*}
     */
    static loadList(siteName, backupsDir) {
        let backupsPath = path.join(backupsDir, siteName);

        if(!Utils.dirExists(backupsPath)) {
            if(Utils.dirExists(backupsDir)) {
                fs.mkdirSync(backupsPath);
            } else {
                return false;
            }
        }

        let files = [];
        let allFiles = fs.readdirSync(backupsPath);
        let index = 0;

        for(let file of allFiles) {
            if(path.parse(file).ext !== '.tar') {
                continue;
            }

            let stats = fs.statSync(path.join(backupsPath, file));
            let size = Backup.convertToMegabytes(stats.size);
            let createdAt = stats.atime;

            files.push({
                id: index,
                name: file,
                size: size,
                url: path.join(backupsPath, file),
                createdAt: Date.parse(createdAt)
            });

            index++;
        }

        files.sort((a,b) => {
            return b.createdAt - a.createdAt;
        });

        files = files.map(item => {
            item.createdAt = moment(new Date(item.createdAt)).format('MM-DD-YYYY HH:mm');

            return item;
        });

        return files;
    }

    /**
     * Creates backup
     *
     * @param siteName
     * @param backupFilename
     * @param backupsDir
     * @param sourceDir
     */
    static create(siteName, backupFilename, backupsDir, sourceDir) {
        let sourcePath = path.join(sourceDir);
        let backupsPath = path.join(backupsDir, siteName);

        if(!Utils.dirExists(backupsPath)) {
            if(Utils.dirExists(backupsDir)) {
                fs.mkdirSync(backupsPath);
            } else {
                process.send({
                    type: 'app-backup-create-error',
                    status: false,
                    error: 'Backup location does not exists'
                });

                return;
            }
        }

        if(Utils.dirExists(backupsPath)) {
            backupFilename = backupFilename.replace(/[^a-z0-9\-\_]/gmi, '');
            let backupFile = path.join(backupsPath, backupFilename + '.tar');

            // Empty the preview/output directories before archiving the backups content
            // as it contains redundant data
            fs.emptyDirSync(path.join(sourcePath, 'output'));
            fs.emptyDirSync(path.join(sourcePath, 'preview'));

            let output = fs.createWriteStream(backupFile);
            let archive = archiver('tar');

            output.on('close', function () {
                process.send({
                    type: 'app-backup-create-success',
                    backups: Backup.loadList(siteName, backupsDir)
                });

                setTimeout(function () {
                    process.exit();
                }, 1000);
            });

            archive.on('error', function (err) {
                process.send({
                    type: 'app-backup-create-error',
                    status: false,
                    error: err
                });

                setTimeout(function () {
                    process.exit();
                }, 1000);
            });

            archive.pipe(output);
            archive.directory(sourcePath, '/');
            archive.finalize();

            return;
        }

        process.send({
            type: 'app-backup-create-error',
            status: false,
            error: 'Backups location not exists'
        });
    }

    /**
     * Removes backup
     *
     * @param siteName
     * @param backupsNames
     * @param backupsDir
     * @returns {{status: boolean, backups: *}}
     */
    static async remove(siteName, backupsNames, backupsDir) {
        for(let backupName of backupsNames) {
            let backupFilePath = path.join(backupsDir, siteName, backupName);

            if (!Utils.fileExists(backupFilePath)) {
                return {
                    status: false,
                    backups: Backup.loadList(siteName, backupsDir)
                };
            }

            try {
                if (
                    os.platform() !== 'linux' && (
                        os.platform() !== 'darwin' || (
                            os.platform() === 'darwin' &&
                            parseInt(os.release().split('.')[0], 10) >= 16
                        )
                    )
                ) {
                    await (async () => {
                        await trash(backupFilePath);
                    })();
                } else {
                    fs.unlinkSync(backupFilePath);
                }
            } catch (e) {
                return Promise.resolve({
                    status: false,
                    backups: Backup.loadList(siteName, backupsDir)
                });
            }
        }

        return Promise.resolve({
            status: true,
            backups: Backup.loadList(siteName, backupsDir)
        });
    }

    /**
     * Renames backup
     *
     * @param siteName
     * @param oldBackupName
     * @param newBackupName
     * @param backupsDir
     * @returns {{status: boolean, backups: *}}
     */
    static rename(siteName, oldBackupName, newBackupName, backupsDir) {
        let oldBackupFilePath = path.join(backupsDir, siteName, oldBackupName + '.tar');
        let newBackupFilePath = path.join(backupsDir, siteName, newBackupName + '.tar');

        if (!Utils.fileExists(oldBackupFilePath) || Utils.fileExists(newBackupFilePath)) {
            return {
                status: false,
                backups: Backup.loadList(siteName, backupsDir)
            };
        }

        try {
            fs.renameSync(oldBackupFilePath, newBackupFilePath);
        } catch (e) {
            return {
                status: false,
                backups: Backup.loadList(siteName, backupsDir)
            };
        }

        return {
            status: true,
            backups: Backup.loadList(siteName, backupsDir)
        };
    }

    /**
     * Restores backup
     *
     * @param siteName
     * @param backupName
     * @param backupsDir
     * @param destinationDir
     * @param tempDir
     */
    static restore(siteName, backupName, backupsDir, destinationDir, tempDir) {
        let backupFilePath = path.join(backupsDir, siteName, backupName);
        let destinationPath = path.join(destinationDir, siteName);

        if(!Utils.fileExists(backupFilePath)) {
            process.send({
                type: 'app-backup-restore-error',
                status: false,
                error: 'Backup file does not exists'
            });

            return;
        }

        if(!Utils.dirExists(destinationDir)) {
            process.send({
                type: 'app-backup-restore-error',
                status: false,
                error: 'Destination directory does not exists'
            });

            return;
        }

        if(!Utils.dirExists(tempDir)) {
            fs.mkdirSync(tempDir);

            if(!Utils.dirExists(tempDir)) {
                process.send({
                    type: 'app-backup-restore-error',
                    status: false,
                    error: 'Temporary directory does not exists'
                });

                return;
            }
        }

        // Empty the temp directory before extracting the backups content
        fs.emptyDirSync(tempDir);

        let extractor = tar.Extract({
            path: tempDir
        })
            .on('error', function(err) {
                process.send({
                    type: 'app-backup-restore-error',
                    status: false,
                    error: 'An error during the file save process'
                });

                setTimeout(function () {
                    process.exit();
                }, 1000);
            })
            .on('end', function() {
                // Verify the backup
                let backupTest = Backup.verify(tempDir, siteName);

                if(!backupTest) {
                    setTimeout(function () {
                        process.exit();
                    }, 1000);

                    return;
                }

                // Close DB connection and remove site dir contents
                process.send({
                    type: 'app-backup-restore-close-db',
                    status: true
                });

                fs.emptyDirSync(destinationPath);

                // Move files from the temp dir to the site dir
                let backupContents = fs.readdirSync(tempDir);

                for(let content of backupContents) {
                    fs.moveSync(
                        path.join(tempDir, content),
                        path.join(destinationPath, content)
                    );
                }

                process.send({
                    type: 'app-backup-restore-success',
                    status: true
                });
            });

        fs.createReadStream(backupFilePath)
            .on('error', function(err) {
                process.send({
                    type: 'app-backup-restore-error',
                    status: false,
                    error: 'An error occurred during reading of backup file'
                });

                setTimeout(function () {
                    process.exit();
                }, 1000);
            })
            .pipe(extractor);
    }

    /**
     * Verifies backup
     *
     * @param backupDir
     * @param siteName
     * @returns {boolean}
     */
    static verify(backupDir, siteName) {
        let foundedErrors = false;
        let configFilePath = path.join(backupDir, 'input', 'config', 'site.config.json');
        let dirsToCheck = [
            path.join(backupDir, 'input'),
            path.join(backupDir, 'input', 'config'),
            path.join(backupDir, 'input', 'media'),
            path.join(backupDir, 'input', 'themes'),
        ];
        let filesToCheck = [
            path.join(backupDir, 'input', 'db.sqlite'),
            configFilePath
        ];

        for(let i = 0; i < dirsToCheck.length; i++) {
            if (!Utils.dirExists(dirsToCheck[i])) {
                foundedErrors = true;
            }
        }

        for(let i = 0; i < filesToCheck.length; i++) {
            if (!Utils.fileExists(filesToCheck[i])) {
                foundedErrors = true;
            }
        }

        // If errors were founded
        if(foundedErrors) {
            process.send({
                type: 'app-backup-restore-error',
                status: false,
                error: 'The backup file is corrupted - aborting the restore process.'
            });

            return false;
        }

        Backup.checkSiteName(siteName, configFilePath);

        return true;
    }

    /**
     *
     * Check if the site name in the config file is the same as the current site name
     *
     * if not - change the config before the backup restore
     *
     * @param siteName - name of the website to check
     * @param configFilePath - path to the temporary config file
     *
     */
    static checkSiteName(siteName, configFilePath) {
        let configContent = fs.readFileSync(configFilePath);

        try {
            configContent = JSON.parse(configContent);

            if(configContent.name !== siteName) {
                configContent.name = siteName;
                fs.writeFileSync(configFilePath, JSON.stringify(configContent, null, 4));
            }
        } catch(e) {
            console.log('modules/backup.js: Wrong site.config.json file');
        }
    }

    /**
     * Converts bytes to megabytes
     *
     * @param fileSizeInBytes
     * @returns {string}
     */
    static convertToMegabytes(fileSizeInBytes) {
        return Number(fileSizeInBytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
}

module.exports = Backup;
