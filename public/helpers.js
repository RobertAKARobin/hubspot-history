'use strict';

//TODO: Nest all these in some kind of helpers object

Number.prototype._leftpad = function(places){
	var number = this;
	return (Array(places || 1).join('0') + number).slice(0 - places);
}
Array._fromCSV = function(string){
	string = (string || '').trim();
	return (string ? string.split(',') : []);
}
Array.prototype._addIfDoesNotInclude = function(item){
	var array = this;
	if(array.indexOf(item) < 0){
		array.push(item);
	}
	return array;
}
Array.prototype._sortOn = function(sortProperty){
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
Array.prototype._intersectionWith = function(comparator){
	var source = this;
	var output = [];
	for(var i = 0; i < source.length; i++){
		if(comparator.indexOf(source[i]) > -1){
			output.push(source[i]);
		}
	}
	return output;
}
Array.prototype._mapToObject = function(callback){
	var array = this;
	var output = {};
	var mappedItem;
	for(var i = 0; i < array.length; i++){
		mappedItem = callback(array[i]);
		output[mappedItem.key] = mappedItem.value;
	}
	return output;
}
Array.prototype._last = function(){
	var array = this;
	return (array[array.length - 1]);
}
Array.prototype._expand = function(callback){
	var array = this;
	var output = [];
	for(var i = 0; i < array.length; i++){
		callback(output, array[i], i);
	}
	return output;
}
Array.prototype._remove = function(item){
	var array = this;
	var index = array.indexOf(item);
	if(index > -1){
		array.splice(index, 1);
	}
	return array;
}
Date.prototype._toPrettyString = function(){
	var date = this;
	return [
		date.getFullYear().toString().slice(-2),
		'/',
		(date.getMonth() + 1)._leftpad(2),
		'/',
		date.getDay()._leftpad(2),
		' ',
		date.getHours()._leftpad(2),
		':',
		date.getMinutes()._leftpad(2)
	].join('');
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
