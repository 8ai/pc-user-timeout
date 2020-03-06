window.addEventListener('keyup', ev=>{
  if(ev.code == 'F12'){
    ipcRenderer.send('set', {action: 'devTools', type: app && app.type});
  }
}, true);

ipcRenderer.on('set', (event, data)=>{
  switch(data.action){
    case 'status':
      if(app) app.status = data.status;
      break;
    case 'settings':
      if(app) app.settings = data.settings;
      break;
    case 'i18n':
      if(app) app.i18n = data.i18n;
      break;
  }
});

let app;
window.addEventListener('load', ev=>{
  new Vue({
    el: '#app',
    data: {
      type: 'main',
      keys:{
        settings: false,
        loaded: false
      },
      settings: ipcRenderer.sendSync('get', {action: 'settings'}) || {},
      status: ipcRenderer.sendSync('get', {action: 'status'}) || {},
      i18n: ipcRenderer.sendSync('get', {action: 'i18n'}) || {},
    },
    methods:{
      changeStatus(ev, status){
        ev && ev.preventDefault();
        ipcRenderer.send('set', {action: 'status', type: status});
      },
      hide(ev){
        ev && ev.preventDefault();
        ipcRenderer.send('set', {action: 'hide'});
      },
      showSettings(ev){
        ev && ev.preventDefault();
        ipcRenderer.send('set', {action: 'showSettings'});
      },
      saveSettings(ev){
        ev && ev.preventDefault();
        ipcRenderer.send('set', {action: 'settings', settings: this.settings});
      },
      updateI18n(ev){
        ev && ev.preventDefault();
        ipcRenderer.send('set', {action: 'updateI18n'});
      }
    },
    mounted(){
      app = this;
      this.keys.loaded = true;
      this.type = process.argv[process.argv.length - 1].match(/type=(.*)/)[1];
      document.title = this.$options.filters.i18n('Timeouts withing the hour');
    },
    watch:{
      'settings.lang'(n,o){
        if(!n || !o) return;
        if(n != o){
          this.$nextTick(()=>{
            document.title = this.$options.filters.i18n('Timeouts withing the hour');
          });
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
      },
      i18n(text){
        if(!app || !app.i18n || !app.i18n[app.settings.lang] || !app.i18n[app.settings.lang][text]){
          return text;
        }
        
        return app.i18n[app.settings.lang][text];
      }
    }
  });
});