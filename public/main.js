'use strict';

var Controls = (function(){

	return {
		view: function(){
			return [
				m('h2', 'Hello, Mithril')
			]
		}
	}

})();

window.addEventListener('DOMContentLoaded', function(){
	m.mount(document.getElementById('display'), Controls);
});
