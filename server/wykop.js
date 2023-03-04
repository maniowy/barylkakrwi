const axios = require('axios');
const fs = require('fs');

function postAxios(url, data, header, logger) {
    const dataStr = (typeof data == 'string' ? data : JSON.stringify(data));
    logger.debug(`postAxios: ${url} ${dataStr.slice(0,300)} ${header?JSON.stringify(header).slice(0,300):""}`);
    if (data && typeof data != 'string') {
        logger.debug(`post params: ${[...Object.keys(data)]}`);
    }

    const options = {
        method: 'POST',
        headers: header
    };
    logger.trace(`options: `, options);

    return new Promise((resolve, reject) => {
        axios.post(url, data, {headers: header})
            .then((res) => {
                logger.debug("got response: ", res.data);
                if (res.data.data == null) {
                    if (res.data.error) {
                        reject(res.data.error);
                    }
                    else {
                        reject(res)
                    }
                } else {
                    resolve(res.data);
                }
            })
            .catch((err) => {
                logger.debug('Axios POST error:  ', err)
                reject(err)
            });
    });
}

class Wykop {

    constructor(logger) {
        this.baseUrl = "https://wykop.pl/api/v3";
        this.logger = logger;
    }

    provideSecrets(confidential) {
        this.appKey = confidential.appkey;
        this.secret = confidential.secret;
    }

    async getToken(onSuccess)
    {
        const data = {data: {key: this.appKey, secret: this.secret}};

        try {
            this.logger.debug("Waiting for axios?");
            let result = await postAxios(`${this.baseUrl}/auth`,
                data,
                {'ContentType': 'application/json', 'Accept': 'application/json'},
                this.logger
            );
            this.logger.info("Received response: ", result);
            onSuccess(result.data.token);
        }
        catch (err) {
            this.logger.error("Failed to retrieve the token: ", err);
        }
    }

    async refreshToken(rToken, onSuccess)
    {
        const data = {data: {refresh_token: rToken}};

        try {
            let result = await postAxios(`${this.baseUrl}/refresh-token`,
                data,
                {'ContentType': 'application/json', 'Accept': 'application/json'},
                this.logger
            );
            this.logger.info("Received response: ", result);
            onSuccess(result.data.token, result.data.refresh_token);
        }
        catch (err) {
            this.logger.error("Failed to refresh the token: ", err);
        }
    }

    createUrlArgs(urlParams, namedParams, queryParams) {
        const baseUrl = `${this.baseUrl}/${urlParams.join('/')}`;
        let namedParamsJoined = "";
        if (namedParams) {
            namedParamsJoined = Object.entries(namedParams).map(([key, value]) => `/${key}/${value}`).join('');
        }
        let queryParamsJoined = "";
        if (queryParams) {
            queryParamsJoined = "?" + Object.entries(queryParams).map(([key, value]) => `${key}=${value}`).join('&');
        }
        return `${baseUrl}${namedParamsJoined}${queryParamsJoined}`;
    }

    createUrl(options) {
        this.logger.debug("createUrl: ", options)
        return this.createUrlArgs(options.urlParams, options.namedParams, options.queryParams);
    }

    connectUrl(token, onSuccess) {
        let url = this.createUrl({urlParams: ["connect"]});
        this.logger.debug(`connectUrl: get of ${url}`)
        axios.get(`${url}`, {headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }}).then((data) => {
            this.logger.debug(`Connect url: ${data.data}`, data.data.data.connect_url);
            onSuccess(data.data.data.connect_url);
        }).catch((err) => this.logger.error(`Failed to get connect url: ${err}`, err))
    }

    entryUrl(id) {
        return `https://www.wykop.pl/wpis/${id}`;
    }

    userProfile(token, onSuccess, onError) {
        axios.get(`${this.baseUrl}/profile/short`, {headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }}).then((response) => {
            this.logger.debug(`User data: ${response.data}`, response.data.data);
            this.logger.debug(`Username: ${response.data.data.username}`);
            onSuccess(response.data.data.username);
        }).catch((err) => {
            this.logger.error(`Failed to get user data: `, err);
            if (onError) {
                onError(err?.response?.data);
            }
        });
    }

    getPageRequestUrl(tagName, pageId) {
        let queryParams = {
            sort: 'all'
        }
        if (pageId) {
            queryParams.page = pageId
        }
        return this.createUrl({urlParams: ['tags', tagName, 'stream'], queryParams: queryParams});
    }

    retrievePage(tagName, id, token, onResult) {
        const url = this.getPageRequestUrl(tagName, id);
        this.logger.debug(`Page request url: ${url}`);
        axios.get(url, {headers: {Authorization: `Bearer ${token}`}})
            .then(res => onResult(res.data))
            .catch((err) => this.logger.error(err));
    }

    async uploadPhoto(file, token, onSuccess, onError) {
        const fileData = await fs.promises.readFile(file.filepath);

        const formData = new FormData();
        
        formData.append('file', new Blob([fileData]), file.name);

        const url = this.createUrl({urlParams: ["media", "photos", "upload"], queryParams: {type: 'comments'}});

        const options = {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'barylkakrwi',
            'Content-Type': 'multipart/form-data'
        };
        
        postAxios(url, formData, options, this.logger).then(onSuccess).catch(onError);
    }

    async addEntryCommon(url, request, file, token, onResult, onError) {
        this.logger.debug(`addEntryCommon request: `, request);
        this.logger.trace("addEntryCommon url: ", url);

        const data = {data: request};

        const options = {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'barylkakrwi',
            'Content-Type': 'application/json'
        };

        if (file) {
            this.uploadPhoto(file, token, (photo) => {
                this.logger.debug(`Uploaded photo key: ${photo?.data?.key}`);
                const key = photo?.data?.key;
                data.data.photo = key;

                try {
                    fs.unlinkSync(file.filepath);
                } catch(err) {
                    this.logger.error("Failed to remove the file: ", file.filepath);
                }
                
                postAxios(url,
                    data,
                    options,
                    this.logger).then((res) => {
                      this.logger.info("Received response: ", res);
                      onResult(res);
                }).catch((err) => {
                    this.logger.error("Failure: ", err);
                    onError(err);
                });
            }, (err) => onError(err));
        } else {
            postAxios(url,
                data,
                options,
                this.logger).then((res) => {
                  this.logger.info("Received response: ", res);
                  onResult(res);
            }).catch((err) => {
                this.logger.error("Failure: ", err);
                onError(err);
            });
        }
    }

    async addEntry(request, file, token, onResult, onError) {
        this.logger.debug(`addEntry request: `, request);
        const url = this.createUrl({
            urlParams: ["entries"]
        });
        this.addEntryCommon(url, request, file, token, onResult, onError);
    }

    async addEntryComment(entryId, request, file, token, onResult, onError) {
        this.logger.debug(`addEntryComment request: `, request);
        const url = this.createUrl({
            urlParams: ["entries", entryId, "comments"]
        });
        this.addEntryCommon(url, request, file, token, onResult, onError);
    }
}

module.exports = function(logger) {
    return new Wykop(logger);
};
