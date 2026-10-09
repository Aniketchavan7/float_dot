const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('regionPicker', {
  load:() => ipcRenderer.invoke('fd:region:data'),
  finish:input => ipcRenderer.invoke('fd:region:finish',input)
});
