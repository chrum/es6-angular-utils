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

            // Lets add a callback that, on item self-destruct, will remove it from this collection
            item.onDelete = (itemId) => {
                this.removeItem(itemId);
            };

        }

        return item;
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

    loadItems() {
        this.status.q = api.get(this.endpoint);
        this.status.q.then((response) => {
            for (let data of response) {
                this.addItem(data);
            }

            return response;
        });

        return this.status.q;
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

        return newItem;
    }

    afterItemRemoved(removedItemId) { }
}
