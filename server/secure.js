const crypto = require('crypto');

module.exports = (config, logger) => {
    let module = {}

    const key = config.confidential.encryption.key;
    const algorithm = config.confidential.encryption.algorithm;
    const initializationVector = Buffer.from(config.confidential.encryption.iv);

    module.encrypt = (input) => {
        try {
            if (config.confidential.encryption === undefined) {
                return input;
            }
            const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), initializationVector);
            let encrypted = cipher.update(input);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            return encrypted.toString('base64');
        } catch (e) {
            logger.error(e);
            return input;
        }
    }

    module.decrypt = (input) => {
        try {
            if (config.confidential.encryption === undefined) {
                return input;
            }
            const encryptedText = Buffer.from(input, 'base64');
            const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), initializationVector);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (e) {
            logger.error(e);
            return input;
        }
    }

    return module;
}