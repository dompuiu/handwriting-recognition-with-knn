if ('webkitIndexedDB' in window) {
    window.IDBTransaction = window.webkitIDBTransaction;
    window.IDBKeyRange = window.webkitIDBKeyRange;
}

TrainingSetDB = {
    indexedDB: window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB,

    defaultVer: '2',
    dbName: 'training-set',

    db: null,
    lastId: null,

    onerror: function (e) {
        console.log(e);
    },

    getDbVersion: function () {
        var v = localStorage.getItem('db-ver') || this.defaultVer;
        return v;
    },

    getNextDbVersion: function () {
        var v = Number(this.getDbVersion());

        v += 1;
        v = String(v);

        localStorage.setItem('db-ver', v);

        return v;
    },
    
    getLastId: function(callback) {
        var that = this, db = this.db, transaction, store, keyRange, cursorRequest;

        if (!db) {
            return this.open(function () {
                that.getLastId(callback);
            });
        }

        transaction = db.transaction(["data"], IDBTransaction.READ_WRITE);
        store = transaction.objectStore("data");

        // Get everything in the store;
        keyRange = IDBKeyRange.lowerBound(0);
        cursorRequest = store.openCursor(keyRange, 2);

        cursorRequest.onsuccess = function(e) {
            var result = e.target.result;
            that.lastId = 0;

            if(result && result.value && result.value.id) {
                that.lastId = result.value.id;
            }
            
            if (callback) {
                callback(that.lastId);
            }
                
        };
        
        cursorRequest.onerror = this.onerror;
    },

    open: function (callback) {
        var request = this.indexedDB.open(this.dbName);
        var that = this;

        request.onsuccess = function(e) {
            var v = that.getDbVersion(), upgradeTheNewWay;

            that.db = e.target.result;
            upgradeTheNewWay = !that.db.setVersion;

            // We can only create Object stores in a setVersion transaction;
            if (v != that.db.version) {
                return that.truncate(function () {
                    if (upgradeTheNewWay) {
                        that.open(callback);
                    }
                });
            }

            if (callback) {
                callback();
            }

        };

        request.onerror = this.onerror;
    },

    get: function(where, callback) {
        var that = this,
            db = this.db,
            transaction,
            store,
            keyRange,
            cursorRequest,
            row,
            valid,
            values = [];

        if (!db) {
            return this.open(function () {
                that.get(where, callback);
            });
        }

        transaction = db.transaction(["data"], IDBTransaction.READ_WRITE);
        store = transaction.objectStore("data");

        // Get everything in the store;
        keyRange = IDBKeyRange.lowerBound(0);
        cursorRequest = store.openCursor(keyRange);

        cursorRequest.onsuccess = function(e) {
            var result = e.target.result;
            if(!!result == false) {
                if (callback) {
                    callback(values);
                }
                return;
            }
            
            row = result.value;
            valid = true;
            
            if (where) {
                _.each(where, function(num, key) {
                    if (!row[key] || row[key] !== num) {
                        valid = false;
                    }
                });
            }
            
            if (valid === true) {
                values.push(row);
            }

            that.lastId = result.value.id;

            result.continue();
        };

        cursorRequest.onerror = this.onerror;
    },

    add: function(data, callback) {
        var that = this, db = this.db, transaction, store;

        if (!db) {
            return this.open(function () {
                that.add(data, callback);
            });
        } else if (this.lastId === null) {
            return this.getLastId(function () {
                that.add(data, callback);
            });
        } else if (!data) {
            return false;
        }

        transaction = this.db.transaction(["data"], IDBTransaction.READ_WRITE);
        store = transaction.objectStore("data"),

        this.lastId += 1;
        data.id = this.lastId;

        request = store.put(data);
        request.onsuccess = function(e) {
            if (callback) {
                callback();
            }
        };
        request.onerror = this.onerror;
    },

    remove: function(id, callback) {
        var db = this.db;
        var trans = db.transaction(["data"], IDBTransaction.READ_WRITE);
        var store = trans.objectStore("data");
        var that = this;

        var request = store.delete(id);

        request.onsuccess = function(e) {
            if (callback) {
                callback();
            }
        };

        request.onerror = this.onerror;
    },

    truncate: function (callback) {
        var that = this,
            db = this.db,
            v = this.getNextDbVersion();

        if (!db) {
            return false;
        }
        
        if (db.setVersion) {
            this.upgradeOldWay(db, v, callback);
        } else {
            this.upgradeNewWay(db, v, callback);
        }
        
        this.lastId = 0;
    },

    upgradeOldWay: function (db, v, callback) {
        var that = this, request;

        if (!db) {
            return false;
        }

        request = db.setVersion(v);
        that.db = null;
        
        request.onerror = this.onerror;
        request.onsuccess = function(e) {
            that.createObjectStore(db);
            if (callback) {
                callback();
            }
        };
    },

    upgradeNewWay: function (db, v, callback) {
        var that = this, request;

        if (!db) {
            return false;
        }
        
        db.close();
        that.db = null;
        
        request = this.indexedDB.open(this.dbName, v);
        
        request.onupgradeneeded = function(e) {
            var db = e.target.result;

            that.createObjectStore(db);
            db.close();
            
            if (callback) {
                callback();
            }
        }
    },

    createObjectStore: function (db) {
        if (!db) {
            return false;
        }

        if(db.objectStoreNames.contains("data")) {
            db.deleteObjectStore("data");
        }

        db.createObjectStore("data", {keyPath: "id"});
    }
}