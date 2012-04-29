(function ($) {
    var glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A'],
        MenuView,
        CanvasView,
        TrainingSetView,
        PictureView,
        Picture,
        AppRouter,
        TrainingSet,
        Numbers,
        WaitingMsg,
        ConditionView,
        ResultView,
        knnWorker,
        home,
        conditionView,
        trainingSet,
        resultView,
        router,
        preloader = $('<span></span>').appendTo($('<div class="preloader"></div>').appendTo('body')),
        preloaderInterval;
    
    if ('webkitIndexedDB' in window) {
        window.IDBTransaction = window.webkitIDBTransaction;
        window.IDBKeyRange = window.webkitIDBKeyRange;
    }

    preloaderInterval = setInterval(function () {
        preloader.html(WaitingMsg.getText('Loading'));
    }, 250);
    
    WaitingMsg = {
        waitMsg: 'Thinking ',
        p: 0,
        getText: function (msg) {
            var that = this, waitMsg;
            
            if (msg) {
                this.waitMsg = msg + ' ';
            }
            
            waitMsg = this.waitMsg;
            
            _(this.p).times(function () {
                waitMsg += '.';
            });
            
            this.p += 1;
            if (this.p >= 3) {
                this.p = 0;
            }
            
            return waitMsg;
        }
    }
    
    IndexedDB = {
        indexedDB: window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB,
        db: null,
        defaultVer: '2',
        dbName: 'training-set200',
        lastId: 0,
        
        onerror: function (e) {
            console.log(e);
        },
        
        open: function (callback) {
            var request = this.indexedDB.open(this.dbName);
            var that = this;
            
            request.onsuccess = function(e) {
                var v = localStorage.getItem('db-ver') || that.defaultVer;
                that.db = e.target.result;
                var db = that.db;
                //console.log(db);
                // We can only create Object stores in a setVersion transaction;
                if (v != db.version) {
                    that.truncate(function () {
                        that.getAll(callback);
                    });
                } else {
                    that.getAll(callback);
                }
                
            };

            request.onerror = this.onerror;
        },
        
        getAll: function(callback) {
            var that = this, db = this.db, trans, store, keyRange, cursorRequest, values = [];
            
            trans = db.transaction(["data"], IDBTransaction.READ_WRITE);
            store = trans.objectStore("data");

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

                values.push(result.value);
                
                that.lastId = result.value.id;
                
                result.continue();
            };

            cursorRequest.onerror = this.onerror;
        },
        
        add: function(data, callback) {
            var that = this, 
                trans = this.db.transaction(["data"], IDBTransaction.READ_WRITE);
                store = trans.objectStore("data"),
                this.lastId += 1,
                data.id = this.lastId,
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
            var that = this, db = this.db, setVrequest, v;
            
            v = localStorage.getItem('db-ver');
            if (!v) {
                v = this.defaultVer;
            } else {
                v = Number(v);
                v += 1;
                v = String(v);
            }
            
            localStorage.setItem('db-ver', v);
            
            if (db.setVersion) {                
                setVrequest = db.setVersion(v);

                // onsuccess is the only place we can create Object Stores
                setVrequest.onerror = this.onerror;
                setVrequest.onsuccess = function(e) {
                    if(db.objectStoreNames.contains("data")) {
                        db.deleteObjectStore("data");
                    }
                    var store = db.createObjectStore("data", {keyPath: "id"});
                    
                    if (callback) {
                        callback();
                    }
                };
            } else {
                this.db.close();
                
                setVrequest = this.indexedDB.open(this.dbName, v);
                setVrequest.onupgradeneeded = function(e) {
                    var db = e.target.result;
                    
                    if(db.objectStoreNames.contains("data")) {
                        db.deleteObjectStore("data");
                    }

                    var store = db.createObjectStore("data", {keyPath: "id"});
                    
                    db.close();
                    
                    if (callback) {
                        that.open(callback);
                    }
                }  
            }
        }
                
    }
    
    Numbers = {
        values: [],
        key: 'knn-recognition',
        storage: IndexedDB,
        values: [],
        
        loadStore: function (callback) {
            var that = this;
            
            this.storage.open(function (values) {
                that.values = values || [];
                
                if (callback) {
                    callback();
                }
            });
        },
        
        addToStore: function (data) {
            this.storage.add(data);
        },
        
        removeFromStore: function (id, callback) {
            this.storage.remove(id, callback);
        },
        
        resetStore: function (callback) {
            this.storage.truncate(callback);
        },
        
        getNewId: function () {
            return this.storage.lastId + 1;
        },
        
        count: function () {
            return this.values.length;
        },
        
        getAll: function () {
            /*jqxhr = $.ajax({
                url: 'save.php',
                type: 'post',
                data: {data: JSON.stringify(this.values)}
            });*/
            
            return this.values;
        },
        
        setAll: function (values, callback) {
            var that = this;
            this.values = values;
            
            this.resetStore(function () {
                var i, l;
                for (i = 0, l = that.values.length; i < l; i += 1) {
                    that.addToStore(that.values[i]);
                }
                
                if (callback) {
                    callback();
                }
            });
            
        },
        
        get: function (index) {
            return this.values[index];
        },
        
        set: function (index, value) {
            this.values[index] = value;
            this.addToStore(value);
        },
        
        push: function (value) {
            this.values.push(value);
            this.addToStore(value);
        },
        
        reset: function () {
            this.values = [];
            this.resetStore();
        },
        
        remove: function (from) {
            var rest, removedValue, ids;

            ids = _.pluck(this.values, 'id');
            if (typeof from !== typeof ids[0]) {
                from = parseInt(from, 10);
            }
            
            from = _.indexOf(ids, from);
            
            removedValue = this.values[from];
            rest = this.values.slice(from + 1);
            
            this.values.length = from < 0 ? this.values.length + from : from;
            if (rest.length > 0) {
                this.values = this.values.concat(rest);
            }
            
            if (removedValue.id) {
                this.removeFromStore(removedValue.id);
            }
        }
    }
    
    Pencil = function (context) {
        var tool = this;
        this.started = false;
        // This is called when you start holding down the mouse button.
        // This starts the pencil drawing.
        this.mousedown = function (ev) {
            context.lineWidth = 20;
            context.beginPath();
            context.moveTo(ev._x, ev._y);
            tool.started = true;
        };

        // This function is called every time you move the mouse. Obviously,
        // it only draws if the tool.started state is set to true (when you are
        // holding down the mouse button).
        this.mousemove = function (ev) {
            if (tool.started) {
                context.lineTo(ev._x, ev._y);
                context.stroke();
            }
        };

        // This is called when you release the mouse button.
        this.mouseup = function (ev) {
            if (tool.started) {
                tool.mousemove(ev);
                tool.started = false;
            }
        };
        
        this.mouseout = function (ev) {
            tool.started = false;
        }
        
    };
    
    knnWorker = {
        worker: null,
        callback: null,
        inProgress: false,
        onMessage: function (e) {
            var result = e.data, parts;
            
            if (result.type == 'result') {
                if (this.callback) {
                    this.callback('I think you have drawn: ' + result.value);
                }
                this.inProgress = false;
            } else {
                parts = result.value;
                WaitingMsg.getText('Analyzing sample ' + parts.current + ' out of total ' + parts.total);
            }
            
        },
        
        init: function (dataSet) {
            var that = this;
            
            this.worker = new Worker('scripts/knn-worker.js');
            this.worker.onmessage = function (e) {
                that.onMessage(e);
            };
            
            this.worker.postMessage({
                type: 'init',
                data: dataSet
            });
        },
        
        decode: function (data, callback) {
            if (this.inProgress === true) {
                return false;
            }
            
            this.inProgress = true;
            if (callback) {
                this.callback = callback;
            }
            
            this.worker.postMessage({
                type: 'decode',
                data: data
            });
        },
        
        addToTrainingSet: function (label, data) {
            this.worker.postMessage({
                type: 'add',
                data: data,
                label: label
            });
        }
    }

    Picture = Backbone.Model.extend({
        defaults: {
            data: '',
            type: '',
            bits: []
        }
    });
    
    TrainingSet = Backbone.Collection.extend({
        model: Picture
    });

    MenuView = Backbone.View.extend({
        el: $('.navbar'),
        
        events: {
            "click a": "click"
        },
        
        initialize: function () {
            this.$el.show();
            this.clickHome($('#home'));
        },
        
        click: function (e) {
            switch (e.target.id) {
                case "train":
                    this.clickTrain(e.target);
                    break;
                default:
                    this.clickHome(e.target);
                    
            }
            
            e.preventDefault();
            document.location.hash = e.target.id;
        },
        
        clickHome: function (target) {
            if (trainingSet) {
                trainingSet.hide();
            } else if (!home) {
                home = new CanvasView();
            }
            
            home.setMode('recognize');
            this.switchLink(target);
            
            if (this.checkPrecondition() === false) {
                if (conditionView) {
                    conditionView.show();
                } else {
                    conditionView = new ConditionView();
                }
                home.disable();
            } else {
                home.enable();
            }
        },
        
        clickTrain: function (target) {
            if (!trainingSet) {
                trainingSet = new TrainingSetView();
            } else {
                trainingSet.show();
            }
            
            if (conditionView) {
                conditionView.hide();
            }
            home.setMode('training');
            home.enable();
            
            if (resultView) {
                resultView.hide();
            }
            
            this.switchLink(target);
        },
        
        switchLink: function (target) {
            var parent = $(target).parent();
            parent.siblings().removeClass('active');
            parent.addClass('active');
        },
        
        checkPrecondition: function () {
            var i = [], result = true;
            
            _.each(_.range(glyphs.length), function (item) {
                i[item] = 0;
            });
            
            _.each(Numbers.getAll(), function (item) {
                i[_.indexOf(glyphs, item.type)] += 1;
            }, this);
            
            _.each(i, function (item) {
                if (item < 5) {
                    result = false;
                }
            });
            
            return result;
        }
    });
    
    CanvasView = Backbone.View.extend({
        template: $("#canvasTemplate").html(),
        className: 'canvas-container',
        events: {
            "click .action": "click",
            "click .clear": "reset"
        },
        
        initialize: function () {
            this.render();
            
            this.$canvas = $('canvas', this.$el)
            this.$actionButton = $('.action', this.$el);
            
            this.initCanvas();
        },
        
        render: function () {
            var tmpl = _.template(this.template);
            
            this.$el.html(tmpl({action: this.options.action}));
            $('#container').append(this.$el);
            return this;
        },
        
        initCanvas: function () {
            // Find the canvas element.
            var tool, that = this;
            
            if (!this.$canvas) {
                alert('Error: I cannot find the canvas element!');
                return;
            }

            if (!this.$canvas.get(0).getContext) {
                alert('Error: no canvas.getContext!');
                return;
            }

            // Get the 2D canvas context.
            context = this.$canvas.get(0).getContext('2d');
            if (!context) {
                alert('Error: failed to getContext!');
                return;
            }

            // Pencil tool instance.
            tool = new Pencil(context);
            
            this.$canvas.bind('mousedown mousemove mouseup mouseout', function (e) {
                that.canvasEvent(e, that.$canvas, tool);
            });
        },
        
        canvasEvent: function (ev, canvas, tool) {
            var offset = canvas.offset();
            
            ev._x = ev.pageX - offset.left;
            ev._y = ev.pageY - offset.top;
            
            // Call the event handler of the tool.
            var func = tool[ev.type];
            if (func) {
                func(ev);
            }
        },
        
        setMode: function (mode) {
            this.options.mode = mode;
            this.updateView();
        },
        
        updateView: function () {
            if (this.options.mode === 'training') {
                this.$actionButton.text('Save');
            } else {
                this.$actionButton.text('Decode');
            }
        },
        
        click: function (e) {
            if (this.options.mode === 'training') {
                this.save();
            } else {
                this.decode();
            }
        },
        
        reset: function (e) {
            var canvas = this.$canvas.get(0);
            canvas.width = canvas.width;
        },
        
        save: function () {
            var canvas = this.$canvas.get(0),
                dataURL = canvas.toDataURL("image/png"),
                ctx = canvas.getContext('2d'),
                bits = this.getBits(ctx.getImageData(0, 0, 320, 240).data);
                
            trainingSet.add(dataURL, bits);
            this.reset();
        },
        
        decode: function () {
            var that = this,
                canvas = this.$canvas.get(0),
                ctx = canvas.getContext('2d'),
                bits = this.getBits(ctx.getImageData(0, 0, 320, 240).data),
                decodeResult;
                
            decodeResult = knnWorker.decode(bits, function (result) {
                clearInterval(that.interval);
                resultView.updateResult(result);
                that.reset();
            });
            
            if (decodeResult === false) {
                return false;                
            }
            
            if (!resultView) {
                resultView = new ResultView(WaitingMsg.getText('Thinking'));
            } else {
                resultView.updateResult(WaitingMsg.getText('Thinking'));
            }
            
            this.interval = setInterval(function () {
                resultView.updateResult(WaitingMsg.getText());
            }, 500);
            resultView.show();
            
        },
        
        enable: function () {
            $('button', this.$el).removeAttr('disabled', 'disabled');
        },
        
        disable: function () {
            $('button', this.$el).attr('disabled', 'disabled');
        },
        
        getBits: function (pixels) {
            var i, l, result = [];
            for (i = 0, l = pixels.length; i < l; i +=4) {
                if (pixels[i + 3] !== 0) {
                    result.push(i/4);
                }    
            }
            
            return result;
        }
    });
    
    TrainingSetView = Backbone.View.extend({
        template: $("#traingSetView").html(),
        className: 'history-container',
        
        events: {
            "change #filter select": "setFilter",
            "click #reset-storage": "resetStorage",
            "click .thumbnail": "remove"
        },
        
        initialize: function () {
            this.collection = new TrainingSet(Numbers.getAll());
            this.filterType = '0';
            
            this.render();
            this.$el.find("#filter").append(this.createSelect());
            
            this.on("change:filterType", this.filterByType, this);
            this.collection.on("reset", this.renderList, this);
            this.collection.on("add", this.renderPicture, this);
            
            this.trigger("change:filterType");
        },
        
        render: function () {
            var tmpl = _.template(this.template);
            this.$el.html(tmpl({action: this.options.action}));
            
            this.$listContainer = $('.set', this.$el);
            
            $('#container').append(this.$el);
            this.setResetLinkVisibility();
            return this;
        },
        
        renderList: function () {
            var tmpl = _.template($("#traingSetList").html()),
                description,
                insertPositionElement;
            
            
            this.$listContainer.empty().append(tmpl({
                type: this.filterType
            }));
            
            this.$description = $('ul li:last', this.$el);
            
            _.each(this.collection.models, function (item) {
                this.renderPicture(item);
            }, this);
            
            $('.thumbnails').css('counter-reset', 'item ' + (this.collection.models.length+1));
        },
        
        renderPicture: function (item) {
            var pictureView = new PictureView({
                model: item
            });
            this.$description.after(pictureView.render().el);
            this.$description.hide();
        },
        
        show: function () {
            this.$el.show();
        }, 
        
        hide: function () {
            this.$el.hide();
        },
        
        createSelect: function () {
            var filter = this.$el.find("#filter"),
                select = $('<select class="span1"/>');

            _.each(glyphs, function (item) {
                var option = $("<option/>", {
                    value: item,
                    text: item
                }).appendTo(select);
            });

            return select;
        },
        
        //Set filter property and fire change event
        setFilter: function (e) {
            this.filterType = e.currentTarget.value;
            this.trigger("change:filterType");
        },
        
        //filter the view
        filterByType: function () {
            this.collection.reset(Numbers.getAll(), { silent: true });

            var filterType = this.filterType,
                filtered = _.filter(this.collection.models, function (item) {
                    return item.get("type").toLowerCase() === filterType.toLowerCase();
                });
                
            this.collection.reset(filtered);
        },
        
        add: function (dataURL, bits) {
            var data = {
                    type: this.filterType,
                    data: dataURL,
                    bits: bits,
                    id: Numbers.getNewId()
                };
                
            //update data store
            Numbers.push(data);
            
            knnWorker.addToTrainingSet(this.filterType, bits);
            
            this.collection.add(new Picture(data));
            this.setResetLinkVisibility();
            $('.thumbnails').css(
                'counter-reset',
                'item ' + ($('.thumbnails .span2').length + 1)
            );
        },
        
        resetStorage: function () {
            Numbers.reset();
            this.trigger("change:filterType");
            this.setResetLinkVisibility();
        },
        
        setResetLinkVisibility: function () {
            if (Numbers.count() > 0) {
                $('#reset-storage').show();
            } else {
                $('#reset-storage').hide();
            }
        },
        
        remove: function (e) {
            var id = e.currentTarget.id.substr(4);
            e.preventDefault();
            
            Numbers.remove(id);
            
            this.collection.reset(Numbers.getAll(), { silent: true });
            
            $(e.currentTarget).parent().remove();
            
            if (this.collection.length === 0) {
                this.$description.show();
            }
            
            $('.thumbnails').css(
                'counter-reset',
                'item ' + ($('.thumbnails .span2').length + 1)
            );
        }
    });
    
    ConditionView = Backbone.View.extend({
        template: $("#preconditionFailed").html(),
        className: 'well message',
        
        events: {
            'click a': 'importTrainingSet'
        },
        
        initialize: function () {
            this.render();
        },
        
        render: function () {
            var tmpl = _.template(this.template);
            
            this.$el.html(tmpl());
            
            $('#container').append(this.$el);
            return this;
        },
        
        show: function () {
            this.$el.show();
        }, 
        
        hide: function () {
            this.$el.hide();
        },
        
        importTrainingSet: function () {
            var that = this, url = 'scripts/training-set.json', jqxhr;
            $('body').css('cursor', 'wait');
            
            jqxhr = $.ajax({
                url: url,
            }).done(function (data) {
                Numbers.setAll(data || []);
                $('body').css('cursor', '');
                that.hide();
                home.enable();
                if (trainingSet) {
                    trainingSet.trigger("change:filterType");
                    trainingSet.setResetLinkVisibility();
                }
            }).fail(function() { 
                that.$el.html('<h3>The training set located at `' + url + '` could not be loaded.</h3>');
            });
        }
    });
    
    ResultView = Backbone.View.extend({
        template: $("#result").html(),
        className: 'well message',
        
        initialize: function (result) {
            this.render(result);
            this.$result = $('.result', this.$el);
        },
        
        render: function (result) {
            var tmpl = _.template(this.template);
            
            this.$el.html(tmpl({result: result}));
            
            $('#container').append(this.$el);
            return this;
        },
        
        updateResult: function (result) {
            this.$result.text(result);
        },
        
        show: function () {
            this.$el.show();
        }, 
        
        hide: function () {
            this.$el.hide();
        }
    });
    
    PictureView = Backbone.View.extend({
        template: _.template($("#trainTemplate").html()),
        tagName: "li",
        className: "span2",

        render: function () {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        }
    });
    
    //add routingfdsdsdd
    AppRouter = Backbone.Router.extend({
        routes: {
            "train": "trainingView"
        },

        trainingView: function () {
            $('#train').trigger('click');
        }
    });
    
    //create router instance
    Numbers.loadStore(function () {
        router = new AppRouter();
        knnWorker.init(Numbers.getAll());
        
        clearInterval(preloaderInterval);
        preloader.parent().remove();
        
        new MenuView();
        Backbone.history.start();
    });
    
} (jQuery));
