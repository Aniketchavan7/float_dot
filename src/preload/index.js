const { contextBridge, ipcRenderer } = require('electron');
function subscribe(channel, handler) {
  const listener = (_event, value) => handler(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
contextBridge.exposeInMainWorld('floatDot', {
  status: () => ipcRenderer.invoke('fd:status'),
  settings: input => ipcRenderer.invoke('fd:settings', input),
  credentials: input => ipcRenderer.invoke('fd:credentials', input),
  windows: () => ipcRenderer.invoke('fd:windows'),
  prepare: input => ipcRenderer.invoke('fd:prepare', input),
  transcribe: input => ipcRenderer.invoke('fd:transcribe', input),
  ask: input => ipcRenderer.invoke('fd:ask', input),
  cancel: () => ipcRenderer.invoke('fd:cancel'),
  clear: () => ipcRenderer.invoke('fd:clear'),
  copy: value => ipcRenderer.invoke('fd:copy', value),
  export: value => ipcRenderer.invoke('fd:export', value),
  collapse: () => ipcRenderer.invoke('fd:collapse'),
  expand: () => ipcRenderer.invoke('fd:expand'),
  meetingStart: input => ipcRenderer.invoke('fd:meeting:start', input),
  meetingChunk: input => ipcRenderer.invoke('fd:meeting:chunk', input),
  meetingPause: () => ipcRenderer.invoke('fd:meeting:pause'),
  meetingResume: () => ipcRenderer.invoke('fd:meeting:resume'),
  meetingStop: () => ipcRenderer.invoke('fd:meeting:stop'),
  meetingClear: () => ipcRenderer.invoke('fd:meeting:clear'),
  meetingDeleteSegment: id => ipcRenderer.invoke('fd:meeting:delete-segment', id),
  meetingSummarize: input => ipcRenderer.invoke('fd:meeting:summarize', input),
  meetingExport: input => ipcRenderer.invoke('fd:meeting:export', input),
  onAnswer: handler => subscribe('fd:answer', handler),
  onHotkey: handler => subscribe('fd:hotkey', handler),
  onCancel: handler => subscribe('fd:cancel-recording', handler),
  onMeetingSegment: handler => subscribe('fd:meeting:segment', handler),
  onMeetingError: handler => subscribe('fd:meeting:error', handler),
  onMeetingSummaryStart: handler => subscribe('fd:meeting:summary-started', handler),
  onMeetingSummaryDelta: handler => subscribe('fd:meeting:summary-delta', handler),
  onMeetingSummaryDone: handler => subscribe('fd:meeting:summary-done', handler),
  onMeetingSummaryError: handler => subscribe('fd:meeting:summary-error', handler)
});
