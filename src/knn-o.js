Knn = {
    labels: null,
    trainingSet: null,
    k: 3,
    
    init: function (labels, trainingSet, k) {
        if (!labels || !trainingSet) {
            throw 'The Knn class was not initialized correctly!';
        }
        
        this.labels = labels;
        this.trainingSet = trainingSet;
        
        if (k) {
            this.k = k;
        }
        
        return this;
    },
    
    addToTrainingSet: function (label, data) {
        this.labels.push(label);
        this.trainingSet.push(data);
    },
    
    classify: function (inData, callback) {
        var matrix, sortDistancesIndices, i, vote, classType = {}, max = 0, result;
        
        matrix = this.getDistanceMatrix(inData, callback);
        
        sortDistancesIndices = this.sortDistancesIndices(matrix);
        for (i = 0; i < this.k; i += 1) {
            vote = this.labels[sortDistancesIndices[i]];
            if (classType[vote]) {
                classType[vote] += 1;
            } else {
                classType[vote] = 1;
            }
        }

        _.each(classType, function(num, key){ 
            if (num > max) {
                max = num;
                result = key;
            }
        });
        
        return result;
    },
    
    getDistanceMatrix: function (inData, callback) {
        var result = [], i, l, intersection;
        
        for (i = 0, l = this.trainingSet.length; i < l; i += 1) {
            intersection = _.difference(this.trainingSet[i], inData);
            
            result.push(Math.sqrt(inData.length + this.trainingSet[i].length - (2 * intersection.length)));
            if (callback) {
                callback(i, l);
            }
        }
        
        return result;
    },
    
    sortDistancesIndices: function (matrix) {
        var clone = [], result = [];
        
        _.each(matrix, function (item) {
            clone.push(item);
        });
        
        matrix.sort();
        _.each(matrix, function (item) {
            var idx = _.indexOf(clone, item);
            result.push(idx);
        });
        
        return result;
    }
}