let {Tray, Menu, app, BrowserWindow, ipcMain, globalShortcut, Notification, screen, powerMonitor} = require('electron');
let fs = require('fs');
let url = require('url');
let util = require('util');
let path = require('path');
let childProcess = require('child_process');
let tray, logs, int, allExit;
let settings = {}, i18n = {}, windows = {}, status = {status: 'stop', timeUntilWait: 0, timeWait: 0};
try{
  console.log('Read config', path.join(app.getPath('userData'), 'settings.json'));
   settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'settings.json')));
}catch(e){
  console.log('Cant read settings', e);
}

updateI18n();

/*
https://www.electron.build/configuration/win
https://electronjs.org/docs/api/browser-window
https://electronjs.org/docs/tutorial/keyboard-shortcuts#горячие-клавиши-в-browserwindow
*/

console.originalError = console.error;
console.error = (...args)=>{
  logs && logs.write(new Date().toLocaleString('ru-RU') + ' - ERROR: ' + util.inspect(args) + '\r\n');
  console.originalError.call(console, ...args);
};

ipcMain.on('get', (event, data)=>{
  switch(data.action){
    case 'settings':
      event.returnValue = settings;
      break;
    case 'i18n':
      event.returnValue = i18n;
      break;
    case 'status':
      event.returnValue = status;
      break;
  }

  event.returnValue = {};
});
ipcMain.on('set', (event, data)=>{
  //console.log('set', data);
  switch(data.action){
    case 'settings':
      settings = Object.assign(settings, data.settings);
      settings.gitlab_url = settings.gitlab_url && settings.gitlab_url.replace(/\/api\/v4\//, '');
      fs.writeFileSync(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(settings));

      Object.keys(windows).forEach(key=>{
        windows[key] && windows[key].send('set', {action: 'settings', settings});
      });
      break;
    case 'status':
      if(data.type == 'start'){
        status.status = 'until';
        status.timeUntilWait = (settings.timeUntilWait || 50) * 60;
        status.timeWait = 0;
      }
      if(data.type == 'stop'){
        status.status = 'stop';
        status.timeWait = 0;
        status.timeUntilWait = 0;
      }
      if(data.type == 'pause'){
        status.status = 'pause';
      }
      if(data.type == 'continue'){
        status.status = 'until';
      }
      if(data.type == 'gowait'){
        status.status = 'wait';
        status.timeWait = (settings.timeWait || 10) * 60;
        status.timeUntilWait = 0;
        openWindow('fullscreen', true);
      }
      if(data.type == 'skipwait'){
        status.status = 'until';
        status.timeWait = 0;
        status.timeUntilWait = (settings.timeUntilWaitOnSkipWait || 10) * 60;
        openWindow('fullscreen', false);
      }
      if(data.type == 'snack'){
        status.status = 'snack';
        openWindow('fullscreen', true);
      }
      if(data.type == 'stopsnack'){
        status.status = 'until';
        openWindow('fullscreen', false);
      }
      break;
    case 'hide':
      openWindow('main', false);
      break;
    case 'showSettings':
      openWindow('settings');
      break;
    case 'showFullscreen':
      openWindow('fullscreen', true);
      break;
    case 'skipFullscreen':
      openWindow('fullscreen', false);
      break;
    case 'devTools':
      windows[data.type] && windows[data.type].webContents.openDevTools();
      break;
    case 'updateI18n':
      updateI18n();

      Object.keys(windows).forEach(key=>{
        windows[key] && windows[key].send('set', {action: 'i18n', i18n});
      });
      break;
  }
});

app.on('ready', () => {
  //console.log(screen.getAllDisplays());
  tray = new Tray(path.join(__dirname, 'stopwatch.png'));
  tray.setToolTip('Time management');
  tray.on('click', (ev, bounds, position)=>{
    console.log(ev, bounds, position);
    openWindow('main');
  });

  let contextMenu = Menu.buildFromTemplate([
    {
      label: 'Main window',
      click: () => {
        openWindow('main');
      }
    },

    {
      label: 'Logs',
      click: () => {
        childProcess.exec('explorer ' + path.join(app.getPath('temp'), 'usr.aidev.system.logs.txt'));
      }
    },
    {
      label: 'Exit',
      click: () => {
        allExit = true;
        Object.keys(windows).forEach(key=>windows[key] && windows[key].close && windows[key].close());
        windows = {};
        clearInterval(int);
        logs && logs.end();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  Menu.setApplicationMenu(null);

  console.log('create log file to append', path.join(app.getPath('temp'), 'usr.aidev.time.logs.txt'));
  logs = fs.createWriteStream(path.join(app.getPath('temp'), 'usr.aidev.time.logs.txt'), {flags: 'a'});

  openWindow('main');
  int = setInterval(startTime, 1000);

  powerMonitor.on('lock-screen', () => {
    status.lockdown = true;
  });
  powerMonitor.on('unlock-screen', () => {
    status.lockdown = false;
  });
});

function startTime(){
  if(settings.timeToStop){
    let t = settings.timeToStop.split(':');
    let d = new Date();
    d.setHours(t[0]);
    d.setMinutes(t[1]);
    //console.log(settings.timeToStop, d.getTime(), Date.now())
    if(d.getTime() <= Date.now()){
      status.status = 'stop';
    }
  }

  let suspendCountdown = false;
  if(settings.suspendCountdown === undefined || settings.suspendCountdown === null || settings.suspendCountdown == "yes"){
    suspendCountdown = true;
  }
  if(suspendCountdown && status.lockdown == true){
    suspendCountdown = true;
  }
  else {
    suspendCountdown = false;
  }

  let intStatus = status.status;
  if(intStatus == 'until' && !suspendCountdown){
    status.timeUntilWait--;
    if(status.timeUntilWait <= 0){
      status.status = 'wait';
      status.timeWait = (settings.timeWait || 10) * 60;
      status.timeUntilWait = 0;
      openWindow('fullscreen', true);
    }
  }
  if(intStatus == 'wait'){
    status.timeWait--;
    if(status.timeWait <= 0){
      status.status = 'until';
      status.timeUntilWait = (settings.timeUntilWait || 50) * 60;
      status.timeWait = 0;
      openWindow('fullscreen', false);
    }
  }
  if(intStatus == 'stop'){
    status.timeUntilWait = 0;
    status.timeWait = 0;
  }
  Object.keys(windows).forEach(key=>{
    if(['main', 'fullscreen'].indexOf(key) > -1){
      windows[key].send('set', {action: 'status', status});
    }
  });
}

function openWindow(type, toOpen){
  if(windows[type]){
    if(windows[type].status == 'show' && toOpen == null || toOpen === false){
      windows[type].hide();
    }
    else if(windows[type].status == 'hide' && toOpen == null || toOpen === true){
      windows[type].show();
    }
    console.log(`windows[${type}]Stat`, windows[type].status);
    return;
  }

  windows[type] = new BrowserWindow(Object.assign({
    show: true,
    icon: 'stopwatch.ico',
    webPreferences: {
      nodeIntegration: true,
      additionalArguments: ['type=' + type]
    }
  }, windowParams(type)));

  if(windows[type].fullScreenable){
    windows[type].setAlwaysOnTop(true, 'screen-saver', 1);
  }
  //windows[type].webContents.openDevTools();

  windows[type].status = 'show';

  windows[type].on('close', ev=>{
    if(allExit){
      return;
    }

    ev.preventDefault();
    windows[type].hide();
  });

  windows[type].loadURL(url.format({
    pathname: path.join(__dirname, 'pages/time.html'),
    protocol: 'file:',
    slashes: true
  }));

  windows[type].on('closed', () => {
    delete windows[type];
  });
  windows[type].on('show', ev=>{
    windows[type].status = 'show';
    //console.log(windows[type].status, ev);
  });
  windows[type].on('hide', ev=>{
    windows[type].status = 'hide';
    //console.log(windows[type].status, ev);
  });

  if(toOpen === false){
    windows[type].hide();
  }
}

function windowParams(type){
  let conf = {};
  let {width, height} = screen.getPrimaryDisplay().workAreaSize;
  
  if(type == 'main'){
    conf.x = width - 300;
    conf.y = height - 100;
    conf.width = 230;
    conf.height = 100;
    conf.maxWidth = conf.width;
    conf.maxHeight = conf.height;
    conf.maximazable = false;
    conf.fullscreenable = false;
    conf.frame = false;
    conf.alwaysOnTop = true;    
    conf.skipTaskbar = true;
    //conf.opacity = 0.5;
    conf.transparent = true;
    conf.backgroundColor = '#75ffffff';
  }
  if(type == 'settings'){
    /*let top = height - 400;
    if(windows.main && windows.main.status == 'show'){
      top -= 120;
    }*/
    conf.fullscreenable = false;
    conf.maximazable = false;
    /*conf.x = width - 200;
    conf.y = top;*/
    conf.width = 400;
    conf.height = 410;
    conf.center = true;
  }
  if(type == 'fullscreen'){
    conf.frame = false;
    conf.alwaysOnTop = true;    
    conf.skipTaskbar = true;
    conf.fullscreen = true;
    conf.fullscreenable = true;
    conf.acceptFirstMouse = true;
    conf.transparent = true;
    conf.backgroundColor = '#99333333';
  }
  return conf;
}

function updateI18n(){
  try{
    i18n = {};
    fs.readdirSync(path.join(__dirname, 'langs')).filter(l=>l!='.'&&l!='..').forEach(l=>{
      try{
        i18n[l.replace('.json', '')] = JSON.parse(fs.readFileSync(path.join(__dirname, 'langs', l)));
      }catch(e){}
    });
  }catch(e){
    console.log('Cant read i18n', e);
  }
}