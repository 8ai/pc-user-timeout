window.addEventListener('keyup', ev=>{
  if(ev.code == 'F12'){
    ipcRenderer.send('get', {action: 'devTools', type: app && app.type});
  }
}, true);

ipcRenderer.on('set', (event, data)=>{
  switch(data.action){
    case 'status':
      if(app) app.status = data.status;
      break;
  }
});

let app;
window.addEventListener('load', ev=>{
  app = new Vue({
    el: '#app',
    data: {
      type: 'main',
      keys:{
        settings: false,
      },
      reason: '',
      settings: ipcRenderer.sendSync('get', {action: 'settings'}) || {},
      status: ipcRenderer.sendSync('get', {action: 'status'}) || {}
    },
    methods:{
      hide(){
        ipcRenderer.send('set', {action: 'hide'});
      },
      showSettings(){
        ipcRenderer.send('set', {action: 'showSettings'});
      },
      start(){
        ipcRenderer.send('set', {action: 'status', type: 'start'});
      },
      stop(){
        ipcRenderer.send('set', {action: 'status', type: 'stop'});
      },
      skipFullscreen(){
        ipcRenderer.send('set', {action: 'status', type: 'skipwait'});
      },
      fullscreen(){
        ipcRenderer.send('set', {action: 'status', type: 'gowait'});
      },
      saveSettings(){
        ipcRenderer.send('set', {action: 'settings', settings: this.settings});
      }
    },
    mounted(){
      this.type = process.argv[process.argv.length - 1].match(/type=(.*)/)[1];
    },
    watch:{
      status(val){
        if(val && val.status == 'until'){
          this.reason = 'Времени до перерыва:';
        }
        else if(val && val.status == 'wait'){
          this.reason = 'Устройте себе перерыв, вернитесь к работе через:';
        }
        else{
          this.reason = '';
        }
      }
    },
    filters:{
      formatTime(val){
        if(isNaN(val)){
          return '00:00';
        }
        let minutes = Math.floor(val / 60);
        let seconds = val - (minutes * 60);
        minutes = String(minutes);
        if(minutes.length < 2) minutes = '0'.repeat(2 - minutes.length) + minutes;
        seconds = String(seconds);
        if(seconds.length < 2) seconds = '0'.repeat(2 - seconds.length) + seconds;
        return `${minutes}:${seconds}`;
      }
    }
  });
});