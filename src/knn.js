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
    
    classify: function (inData) {
        var matrix, sortDistancesIndices, i, vote, classType = {}, max = 0, result;
        
        matrix = this.getDifferenceMatrix(inData);
        matrix = this.raiseMatrixToPower(matrix, 2);
        matrix = [this.getSquaredDistance(matrix)];
        matrix = this.raiseMatrixToPower(matrix, 0.5);
        
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
    
    getDifferenceMatrix: function (inData) {
        var result = [], i, l;
        
        if (this.trainingSet[0].length !== inData.length) {
            throw "The matrices cannot be substracted because they don't have the same length.";
        }
        
        for (i = 0, l = this.trainingSet.length; i < l; i += 1) {
            result.push(this.substractMatrixRow(this.trainingSet[i], inData));
        }
        
        return result;
    },
    
    substractMatrixRow: function (row1, row2) {
        var result = [], i, l;
        
        for (i = 0, l = row1.length; i < l; i += 1) {
            result[i] = row1[i] - row2[i];
        }
        
        return result;
    },
    
    raiseMatrixToPower: function (matrix, power) {
        var result = [], i, l;
        
        for (i = 0, l = matrix.length; i < l; i += 1) {
            result.push(this.matrixRowPower(matrix[i], power));
        }
        
        return result;
    },
    
    matrixRowPower: function (row, power) {
        var result = [], i, l;
        
        for (i = 0, l = row.length; i < l; i += 1) {
            result[i] = Math.pow(row[i], power);
        }
        
        return result;
    },
    
    getSquaredDistance: function (matrix) {
        var result = [], i, l, sum;
        
        for (i = 0, l = matrix.length; i < l; i += 1) {
            sum = _.reduce(matrix[i], function(memo, num) { return memo + num; }, 0);
            result.push(sum);
        }
        
        return result;
    },
    
    sortDistancesIndices: function (matrix) {
        var clone = [], result = [];
        
        matrix = matrix[0];
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