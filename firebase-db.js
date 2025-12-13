(function(){
  if (!window.DB) { window.DB = {}; }
  window.DB.isReady = function(){ return true; };
  window.DB.init = async function(){};
  window.DB.getCategoryModels = async function(category){ return []; };
  window.DB.isClientActive = async function(uid){ return true; };
  window.DB.ensureClientRecord = async function(user){};
  window.DB.updateSelf = async function(uid, patch){};
  window.DB.onClientSnapshot = function(uid, cb){ return function(){}; };
})();
