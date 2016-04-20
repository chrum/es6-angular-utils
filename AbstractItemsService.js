let $rootScope;
let $injector;
let api;

let initServices = function ($injector) {
    if (!$rootScope) {
        $rootScope = $injector.get('$rootScope');
    }
    if (!api) {
        api = $injector.get('apiService');
    }
};

export default class AbstractItemsService {
    constructor(_$injector, endpoint) {
        $injector = _$injector;
        initServices($injector);

        this.ItemObject = null;
        this.endpoint = endpoint;
        this.status = {
            q: null,
            loaded: false
        };

        this.data = [];
        this.idGen = this.idGenerator();
    }

    _callingAbstractMethod() {
        console.error('Calling abstract method from: ' + this.constructor.name);
    }

    *idGenerator() {
        let x = 1;
        while (1) {
            yield 'new_' + this.endpoint + x++;
        }
    }

    getFilteredItems(filterBy, value) {
        return this.data.filter((item) => {
            return item[filterBy] === value;
        });
    }

    getItems() {
        return this.data;
    }

    /**
     * @param id
     * @returns {*}
     */
    getItem(id, createEmpty) {
        if (!isNaN(id)) {
            id = parseInt(id, 10);
        }
        let item = this.data.find((el) => el.id === id);
        if (item) {
            return item;

        } else if (createEmpty) {
            return this.addItem({
                id: id
            });

        } else {
            return null;
        }
    }

    exists(id) {
        return this.getItem(id) !== null;
    }

    /**
     * Creates new Item and returns it
     * In case of existing Item with the same id, returns that existing item
     * @param data
     * @returns {*}
     */
    addItem(data) {
        if (this.ItemObject === null) {
            console.error('Please define ItemObject in constructor of this service: ' + this.constructor.name);
            return;
        }

        let item = this.getItem(data.id);
        if (item) {
            item.setData(data, true);

        } else {
            item = new this.ItemObject(data, $injector);
            this.data.push(item);
            this._addItemCallbacks(item);
        }

        return item;
    }

    _addItemCallbacks(item) {
        item.afterDelete = (itemId) => {
            Object.getPrototypeOf(item).afterDelete.call(item);
            this.removeItem(itemId);
        };
        item.onSaveSuccess = (response) => {
            Object.getPrototypeOf(item).onSaveSuccess.call(item, response);
            this.onItemSaved(item);
        }
    }

    removeItem(id) {
        if (!isNaN(id)) {
            id = parseInt(id, 10);
        }
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].id === id) {
                this.data.splice(i, 1);
            }
        }

        this.afterItemRemoved(id);
    }

    /**
     * Simply checks if promise is pending
     * @returns {null|boolean}
     */
    isLoading() {
        let p = this.status.q;
        return p && typeof(p.then) !== 'undefined' && p.$$state.status === 0;
    }

    loadItems(params = {}) {
        this.status.q = api.get(this.endpoint, params);
        this.status.q.then((response) => {
            this.populateData(response);

            return response;
        });

        return this.status.q;
    }

    afterItemsLoaded(callback) {
        if (this.isLoading()) {
            this.status.q.then((response) => {
                callback();
                return response;

            });
        } else {
            callback();
        }
    }

    populateData(data) {
        for (let item of data) {
            this.addItem(item);
        }
    }

    whenItemsLoaded(callback) {
        if (this.isLoading()) {
            this.status.q.then(callback);

        } else {
            callback();
        }
    }

    createNew(dataObject) {
        dataObject.id = this.idGen.next().value;
        let newItem = new this.ItemObject(dataObject, $injector);
        this._addItemCallbacks(newItem);

        return newItem;
    }

    afterItemRemoved(removedItemId) { }
    onItemSaved(savedItem) { }
}
