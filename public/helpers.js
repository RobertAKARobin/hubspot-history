'use strict';

//TODO: Nest all these in some kind of helpers object

Array.fromCSV = function(string){
	string = (string || '').trim();
	return (string ? string.split(',') : []);
}
Array.prototype.addIfDoesNotInclude = function(item){
	var array = this;
	if(array.indexOf(item) < 0){
		array.push(item);
	}
	return array;
}
Array.prototype.sortOn = function(sortProperty){
	var array = this;
	var sortFunction = ((sortProperty instanceof Function) ? sortProperty : function(item){
		return item[sortProperty];
	});
	return array.sort(function(itemA, itemB){
		var valA = (sortFunction(itemA) || 0);
		var valB = (sortFunction(itemB) || 0);
		if(valA > valB){
			return 1
		}else if(valA < valB){
			return -1
		}else{
			return 0;
		}
	});
}
Array.prototype.intersectionWith = function(comparator){
	var source = this;
	var output = [];
	for(var i = 0; i < source.length; i++){
		if(comparator.indexOf(source[i]) > -1){
			output.push(source[i]);
		}
	}
	return output;
}
Array.prototype.mapToObject = function(callback){
	var array = this;
	var output = {};
	for(var i = 0; i < array.length; i++){
		callback(output, array[i]);
	}
	return output;
}
Array.prototype.last = function(){
	var array = this;
	return (array[array.length - 1]);
}
Array.prototype.expand = function(callback){
	var array = this;
	var output = [];
	for(var i = 0; i < array.length; i++){
		callback(output, array[i], i);
	}
	return output;
}
Array.prototype.remove = function(item){
	var array = this;
	var index = array.indexOf(item);
	if(index > -1){
		array.splice(index, 1);
	}
	return array;
}
Date.prototype.getMonthWithZeroes = function(){
	var date = this;
	return ('0' + (date.getMonth()+1)).slice(-2);
}
Date.prototype.getDateWithZeroes = function(){
	var date = this;
	return ('0' + date.getDate()).slice(-2);
}
Date.prototype.toArray = function(){
	var date = this;
	return [date.getFullYear(), date.getMonthWithZeroes(), date.getDateWithZeroes()];
}
Object.defineProperty(Object.prototype, '_merge', {
	enumerable: false,
	value: function(input){
		var object = this;
		for(var key in object){
			input[key] = object[key];
		}
		return input;
	}
})
