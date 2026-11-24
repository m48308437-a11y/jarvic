const { contextBridge, ipcRenderer: ipc } = require('electron');
contextBridge.exposeInMainWorld('api', {
  convList: q => ipc.invoke('conv:list', q), convNew: () => ipc.invoke('conv:new'),
  convGet: id => ipc.invoke('conv:get', id), convRename: (id, t) => ipc.invoke('conv:rename', id, t),
  convDelete: id => ipc.invoke('conv:delete', id), historyClear: () => ipc.invoke('history:clear'),
  settingsGet: () => ipc.invoke('settings:get'), settingsSet: s => ipc.invoke('settings:set', s),
  send: (convId, text) => ipc.invoke('chat:send', convId, text), abort: () => ipc.invoke('chat:abort'),
  sysInfo: () => ipc.invoke('sys:info'), openUrl: u => ipc.invoke('sys:openUrl', u),
  onChunk: cb => ipc.on('chat:chunk', (_, d) => cb(d))
});
