let $rootScope;
let $q;
let api;

function initServices($injector) {
    if (!api) { api = $injector.get('apiService'); }
    if (!$q) { $q = $injector.get('$q'); }
    if (!$rootScope) { $rootScope = $injector.get('$rootScope'); }
}

export default class AbstractItem {
    constructor(data, endpoint, $injector) {
        this.status = {
            q: null, // stores promise when details are being loaded
            loaded: false,
            saved: false
        };
        this._setId(data.id);
        this.endpoint = endpoint;

        this.data = {};
        this.setData(data);

        initServices($injector);


        if (!this._checkData()) {

        }
    }

    _setId(id) {
        if (this.isNew(id)) {
            this.id = id;
            this.status.saved = false;

        } else {
            this.id = parseInt(id, 10);
            this.status.saved = true;
        }
    }

    _checkData() {
        if (!this.id && this.data.id.indexOf('new') !== 0) {
            console.error('Missing item id');
            return false;
        }

        return true;
    }

    isNew(id) {
        id = id || this.data.id;
        return typeof(id) === 'string' && id.indexOf('new') === 0;
    }

    save (onSuccess = () => {}, onFail = null) {
        let toSend = this.beforeSave(this.data);
        if (this.isNew()) {
            this.status.q = api.post(this.endpoint, {}, toSend, onSuccess, onFail)
                .then((r) => {
                    this.afterCreate(r);
                    this.onSaveSuccess(r);
                    this._setId(this.data.id);
                    return r;
                })
                .catch((r, code) => {
                    this._onSaveError(r, code);
                    return r;
                });

        } else {
            this.status.q = api.put(this.endpoint + '/' + this.id, {}, toSend, onSuccess, onFail)
                .then((r) => {
                    this.onSaveSuccess(r);
                    this.afterSave(r);
                    return r;
                })
                .catch((r) => {
                    this._onSaveError(r, r.status);
                    return r;
                });
        }

        return this.status.q;
    }

    onSaveSuccess(response) {
        this.setData(response, true);
        this.status.loaded = true;
    }

    _onSaveError(response, code) {
        if (code === 403) {
            alert('You are trying to make changes where you are not allowed to.');

        } else {
        }
    }

    revert() {
        this.status.loaded = false;
        this.loadDetails(true);
    }

    /**
     * loads item details, to be called from child object
     * @returns {promise|this}
     */
    loadDetails (overwrite = false) {
        if (this.status.loaded) {
            return this;
        }

        // Check if the loading process havent been started, if so, return its promise
        if (this.isLoadingDetails()) {
            return this.status.q;
        }

        this.status.q = api.get(this.endpoint + '/' + this.id);
        this.status.q.then((response) => {
            this.setData(response, overwrite);
            this.afterDetailsLoaded();
            this.status.loaded = true;
            return response;

        }).catch((response, responseCode) => {
            if (responseCode === 204) {
                // Trying to load non existing screen
                this.onDelete();

            } else {
                this.onDetailsError(response, response.status);
            }
            return response;
        });

        return this.status.q;
    }

    isLoadingDetails() {
        if (!this.status.loaded) {
            let p = this.status.q;
            return p && typeof(p.then) !== 'undefined' && p.$$state.status === 0;
        }

        return false;
    }

    /**
     * Sets data only if:
     * 1a. Incoming data has the actual value
     * 1b. There is no data that will be overwritten
     * 2. overwrite is set
     * @param data
     * @param overwrite - whether the data should be overwritten when present
     */
    setData(data, overwrite = false) {
        this._setData(data, this.data, overwrite);

        if (!this.initialized || overwrite) {
            this.afterInitialDataSet();
            this.initialized = true;
        }
    }

    /**
     *
     * @param source
     * @param destination
     * @param overwrite
     * @param onlyExisting - if set, only items existing in destination will be updated
     * @private
     */
    _setData(source, destination, overwrite = false, onlyExisting = false) {
        let toIterate = onlyExisting ? destination : source;
        for (var x in toIterate) {
            if (source.hasOwnProperty(x)) {
                if (overwrite || (source[x] !== null && source[x] !== '' && typeof(destination[x]) === 'undefined')) {
                    destination[x] = angular.copy(source[x]);
                }
            }
        }
    }

    delete(urlParams = {}, locally = false) {
        if (!locally) {
            return api.delete(this.endpoint + '/' + this.id, urlParams)
                .then((response) => {
                    this.afterDelete(this.id);
                    return response;
                });
        }

    }

    beforeSave(data) {
        return data;
    }

    afterCreate(callback) { }
    afterSave() { }
    afterInitialDataSet() { }
    afterDetailsLoaded() { }
    onDetailsError(response, code) {
        if (code === 403) {
            this.onDelete();
        }
    }
    afterDelete(itemId) { }
}
