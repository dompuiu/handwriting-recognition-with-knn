var init, initComplete = false, dataSet = [], labels = [], p = 0, knn;
importScripts('http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.3.3/underscore-min.js', '../../src/knn-o.js');

init = function (set) {
    var i, l, bitMap, label;
    for (i = 0, l = set.length; i < l; i += 1) {
        label = set[i].type;
        
        dataSet.push(set[i].bits);
        labels.push(label);
    }
    
    knn = Knn.init(labels, dataSet, 10);
    initComplete = true;
}

decode = function (data) {
    return knn.classify(data, function (i, l) {
        postMessage({
            type: 'info',
            value: {
                current: i,
                total: l
            }
        });
    });
}

getWaitMsgText = function () {
    var waitMsg = 'Thinking ';
    
    _(p).times(function () {
        waitMsg += '.';
    });
    
    p += 1;
    if (p >= 3) {
        p = 0;
    }
    
    return waitMsg;
}

onmessage = function(e) {
    var params = e.data;
    
    switch (params.type) {
        case "add":
            knn.addToTrainingSet(params.label, params.data);
            break;
            
        case "decode":
            if (initComplete === false) {
                postMessage(getWaitMsgText());
                
                setTimeout(function () {
                    onmessage(e);
                }, 500);
                
                return;
            }
            
            postMessage({
                type: 'result',
                value: decode(params.data)
            });
            break;
            
        default:
            init(params.data);
    }
};