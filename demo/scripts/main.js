(function ($) {
    var glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], intervalId, timeoutId;
    
    
    var MenuView,
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
        canvasView,
        conditionView,
        trainingSet,
        resultView,
        router,
        preloader = $('<span></span>').appendTo($('<div class="preloader"></div>').appendTo('body')),
        intervalId,
        app;

    intervalId = setInterval(function () {
        preloader.html(WaitingMsg.getText('Loading '));
    }, 250);

    WaitingMsg = {
        waitMsg: 'Thinking ',
        p: 0,
        getText: function (msg, noEllipsis) {
            var that = this, waitMsg;

            if (msg) {
                this.waitMsg = msg;
            }

            waitMsg = this.waitMsg;

            if (noEllipsis !== true) {
                _(this.p).times(function () {
                    waitMsg += '.';
                });

                this.p += 1;
                if (this.p > 3) {
                    this.p = 0;
                }
            }

            return waitMsg;
        }
    }

    Numbers = {
        values: [],
        key: 'knn-recognition',
        storage: TrainingSetDB,
        values: [],

        loadStore: function (callback) {
            var that = this;

            this.storage.get(null, function (values) {
                that.values = values || [];

                if (callback) {
                    callback();
                }
            });
        },

        addToStore: function (data, callback) {
            this.storage.add(data, callback);
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
            return this.values;
        },

        setAll: function (values, callback) {
            var that = this, i, l, count = 0;

            for (i = 0, l = values.length; i < l; i += 1) {
                if (_.indexOf(glyphs, values[i].type) === -1) {
                    count += 1;
                    
                    if (count === l && callback) {
                        callback();
                    }
                    continue;
                }
                
                that.addToStore(values[i], function (record) {
                    that.values.push(record);
                    count += 1;
                    resultView.updateResult('Added glyph ' + count + ' out of a total of ' + l + '.');
                    
                    if (count === l) {
                        if (callback) {
                            callback();
                        }
                    }
                });
            }


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

    Pencil = function (view) {
        var tool = this, canvas = view.$canvas.get(0), context;
        
        this.started = false;
        if (!canvas.getContext) {
            alert('Error: no canvas.getContext!');
            return;
        }

        // Get the 2D canvas context.
        context = canvas.getContext('2d');
        if (!context) {
                alert('Error: failed to getContext!');
                return;
            }
        
         if (!canvas.getContext) {
            alert('Error: no canvas.getContext!');
            return;
        }

        // Get the 2D canvas context.
        context = canvas.getContext('2d');
        if (!context) {
            alert('Error: failed to getContext!');
            return;
        }
        
        
        // This is called when you start holding down the mouse button.
        // This starts the pencil drawing.
        this.mousedown = function (ev) {
            if (view.readOnly === true) {
                return false;
            }

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
            if (this.worker === null) {
                return;
            }
            
            if (result.type == 'log') {
                console.log(result.value);
            } else if (result.type == 'result') {
                if (this.callback) {
                    this.callback('I think you have drawn: ' + result.value);
                }
                this.inProgress = false;
            } else {
                parts = result.value;
                WaitingMsg.getText('Analyzing sample ' + parts.current + ' out of a total of ' + parts.total + '.', true);
            }

        },

        init: function () {
            var that = this;

            this.worker = new Worker('scripts/knn-worker.js');
            this.worker.onmessage = function (e) {
                that.onMessage(e);
            };

            this.worker.postMessage({
                type: 'init',
                data: Numbers.getAll()
            });
        },

        decode: function (data, callback) {
            if (!this.worker) {
                this.init();
            }

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
            if (!this.worker) {
                this.init();
            }

            this.worker.postMessage({
                type: 'add',
                data: data,
                label: label
            });
        },

        destroy: function () {
            if (this.inProgress) {
                this.worker.terminate();
                this.inProgress = false;
                this.worker = null;
            }
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
            
            this.clearTimeoutsAndIntervals();
            e.preventDefault();
            document.location.hash = e.target.id;
        },

        clickHome: function (target) {
            if (trainingSet) {
                trainingSet.hide();
            } else if (!canvasView) {
                canvasView = new CanvasView();
                resultView = new ResultView();
                conditionView = new ConditionView();
            }

            canvasView.setMode('recognize');
            canvasView.reset();
            this.switchLink(target);

            this.updateView();
        },

        clickTrain: function (target) {
            canvasView.reset();

            if (!trainingSet) {
                trainingSet = new TrainingSetView();
            } else {
                trainingSet.show();
            }

            if (conditionView) {
                conditionView.hide();
            }
            canvasView.setMode('training');
            canvasView.enable();

            resultView.hide();

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
        },
        
        updateView: function () {
            if (this.checkPrecondition() === false) {
                conditionView.show();
                canvasView.disable();
            } else {
                canvasView.enable();
            }
        },
        
        clearTimeoutsAndIntervals: function () {
            clearTimeout(timeoutId);
            clearInterval(intervalId);
        }
    });

    CanvasView = Backbone.View.extend({
        template: $("#canvasTemplate").html(),
        className: 'canvas-container',
        readOnly: false,

        events: {
            "click .action": "click",
            "click .clear": "reset",
            "change #preset-glyph": "loadPresetInCanvas"
        },

        initialize: function () {
            this.render();

            this.$actionButton = $('.action', this.$el);
            this.$resetButton = $('.clear', this.$el);
            this.$presetSlect = $('#preset-glyph', this.$el)
            this.$presetSlectContainer = $('.preset-glyphs', this.$el)
            
            this.initCanvas();
            this.initPresetsSelect();
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
            
            this.$canvas = $('canvas', this.$el);

            if (!this.$canvas) {
                alert('Error: I cannot find the canvas element!');
                return;
            }

            // Pencil tool instance.
            tool = new Pencil(this);

            this.$canvas.bind('mousedown mousemove mouseup mouseout', function (e) {
                that.canvasEvent(e, that.$canvas, tool);
            });
        },
        
        initPresetsSelect: function () {
            var select = this.$presetSlect;
            
            _.each(glyphs, function (item) {
                _.each(_.range(21), function (i) {
                    var option = $("<option/>", {
                        value: item + '_' + i + '.txt',
                        text: 'Glyph ' + item + ' (' + i + ')'
                    }).appendTo(select);
                });            
            });            
            
            $('.preset-glyphs').show();
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
                this.$presetSlectContainer.hide();
            } else {
                this.$actionButton.text('Decode');
                this.$presetSlectContainer.show();
            }
        },

        click: function (e) {
            if (this.options.mode === 'training') {
                this.save();
            } else {
                this.decode();
            }
        },

        clearCanvas: function () {
            var canvas = this.$canvas.get(0);
            canvas.width = canvas.width;
        },

        reset: function () {
            this.clearCanvas();
            this.switchFromReadOnly();
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
                msg = WaitingMsg.getText('Thinking ...', true),
                decodeResult;

            if (bits.length > 0) {
                this.switchToReadOnly();

                decodeResult = knnWorker.decode(bits, function (result) {
                    clearInterval(that.interval);
                    resultView.updateResult(result);
                    that.clearCanvas();
                    this.switchFromReadOnly();
                });

                if (decodeResult === false) {
                    return false;
                }
            } else {
                msg = "You didn't draw anything.";
            }

            resultView.updateResult(msg);

            if (bits.length > 0) {
                this.interval = setInterval(function () {
                    resultView.updateResult(WaitingMsg.getText(null, true));
                }, 500);
            }

        },

        enable: function () {
            this.readOnly = false;
            $('button', this.$el).removeAttr('disabled', 'disabled');
            this.$presetSlect.removeAttr('disabled', 'disabled');
        },

        disable: function () {
            this.readOnly = true;
            $('button', this.$el).attr('disabled', 'disabled');
            this.$presetSlect.attr('disabled', 'disabled');
        },

        getBits: function (pixels) {
            var i, l, result = [];
            for (i = 0, l = pixels.length; i < l; i +=4) {
                if (pixels[i + 3] !== 0) {
                    result.push(i/4);
                }
            }

            return result;
        },

        switchToReadOnly: function () {
            this.readOnly = true;

            this.$actionButton.attr('disabled', 'disabled');
            this.$resetButton.text('Stop');
            this.$presetSlect.attr('disabled', 'disabled');
        },

        switchFromReadOnly: function () {
            if (this.readOnly === false) {
                return;
            }
            
            clearInterval(this.interval);
            this.readOnly = false;

            knnWorker.destroy();
            resultView.hide();

            this.$actionButton.removeAttr('disabled', 'disabled');
            this.$presetSlect.removeAttr('disabled', 'disabled');
            this.$resetButton.text('Clear');
        },
        
        loadPresetInCanvas: function (e) {
            var that = this, file = e.currentTarget.value, url = 'test-data/' + file;
            
            $.ajax({
                url: url,
            }).done(function (data) {
                that.drawInCanvas(data);
            }).fail(function() {
                
            });
        },
        
        drawInCanvas: function (data) {
            var canvas = this.$canvas.get(0), 
                ctx = canvas.getContext('2d'),
                bits, pos, i, l;
                        
            this.clearCanvas();
            bits = ctx.getImageData(0, 0, 320, 240);
            data = data.replace(/\n/g, '');
                
            for (i = 0, l = data.length; i < l; i += 1) {
                pos = (i * 4) + 3;
                if (data[i] === "1") {
                    bits.data[pos] = 255;
                }
            }
            ctx.putImageData(bits, 0, 0);
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
        fileId: 0,
        failed: false,
        template: $("#preconditionFailed").html(),
        className: 'well message',

        events: {
            'click a': 'importGlyphs'
        },

        initialize: function () {
            this.render();
        },

        render: function () {
            this.hide();
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
        
        getNextFile: function () {
            return 'data/' + this.fileId + '.json';
        },

        importGlyphs: function () {
            var that = this, url = this.getNextFile(), jqxhr;
            
            this.hide();
            $('body').css('cursor', 'wait');
            clearInterval(intervalId);
            if (that.failed === false) {
                intervalId = setInterval(function () {
                    resultView.updateResult(
                        WaitingMsg.getText('Trying to import glyphs from the file "' + url + '"')
                    );
                }, 250);
            }
            
            timeoutId = setTimeout(function () {
                jqxhr = $.ajax({
                    url: url,
                }).done(function (data) {
                    that.failed = false;
                    
                    clearInterval(intervalId);
                    Numbers.setAll(data || [], function () {
                        if (trainingSet) {
                            trainingSet.trigger("change:filterType");
                            trainingSet.setResetLinkVisibility();
                        }
                        that.importComplete(url, 1000, function () {
                            that.fileId += 1;
                            that.importGlyphs();
                        });
                    });
                }).fail(function() {
                    if (that.failed === false) {
                        that.failed = true;
                        that.fileId += 1;
                        
                        that.importGlyphs();
                        return;
                    }
                    
                    clearInterval(intervalId);
                    that.importComplete();

                });
            }, 1000);
        },
        
        importComplete: function (url, timeout, callback) {
            var msg = 'Import process is completed.';
            $('body').css('cursor', '');
            
            if(url) {
                msg = 'Import of the file "' + url + '" was completed.';
            }
            resultView.updateResult(msg);
            
            timeoutId = setTimeout(function () {
                if (callback) {
                    callback();
                } else {
                    resultView.hide();
                    app.updateView();
                }
            }, timeout || 2500);
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
            this.hide();
            var tmpl = _.template(this.template);

            this.$el.html(tmpl({result: result}));

            $('#container').append(this.$el);
            return this;
        },

        updateResult: function (result) {
            this.$result.text(result);
            this.show();
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
        knnWorker.init();

        clearInterval(intervalId);
        preloader.parent().remove();

        app = new MenuView();
        Backbone.history.start();
    });

} (jQuery));
