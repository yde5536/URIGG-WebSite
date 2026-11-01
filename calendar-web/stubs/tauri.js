// 웹에서 코워크 캘린더 위젯을 띄울 때 데스크톱(Tauri) 기능 대신 쓰는 빈 껍데기.
// 창 열기·크기 조절·종료·자동 업데이트는 웹에서는 아무 일도 하지 않는다.

// @tauri-apps/api/event
export const listen = async () => () => {};
export const emitTo = async () => {};

// @tauri-apps/api/window — 위젯 화면이 뜨도록 창 이름을 'widget'으로 둔다
export const getCurrentWindow = () => ({ label: 'widget', startResizeDragging: async () => {} });

// @tauri-apps/api/webviewWindow
export class WebviewWindow {
  static async getByLabel() { return null; }
}

// @tauri-apps/api/core
export const invoke = async () => {};

// @tauri-apps/plugin-updater, @tauri-apps/plugin-process
export const check = async () => null;
export const relaunch = async () => {};
