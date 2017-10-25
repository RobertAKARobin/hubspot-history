'use strict';

Location.query = function(paramsObject, doClear){
	var query = (doClear ? {} : m.parseQueryString((window.location.href.match(/\?.*?$/g) || [])[0]));
	var newurl = window.location.origin + window.location.pathname;
	if(paramsObject){
		for(var key in paramsObject){
			query[key] = paramsObject[key];
		}
		newurl += '?' + m.buildQueryString(query);
		window.history.pushState({path: newurl}, '', newurl);
	}
	return query;
}

window.addEventListener('DOMContentLoaded', function(){
	var mounts = document.querySelectorAll('[data-mount]');
	var alreadyMounted = {};

	for(var i = 0; i < mounts.length; i++){
		mounts[i].addEventListener('click', triggerMounting);
	}

	function triggerMounting(event){
		var triggerElement = event.target;
		var targetName = triggerElement.getAttribute('data-mount');
		if(!alreadyMounted[targetName]){
			triggerElement.parentNode.removeChild(triggerElement);
			m.mount(document.getElementById(targetName), Components[targetName]);
		}
		alreadyMounted[targetName] = true;
	}
});
