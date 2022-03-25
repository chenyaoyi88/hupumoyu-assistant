import * as vscode from 'vscode';
import NBATreeView from './treeView/nba';
import BxjTreeView from './webview/bxj';
import IndexCommands from './commands';

export let _context: vscode.ExtensionContext;

// 插件激活
export function activate(context: vscode.ExtensionContext) {
	_context = context;
	vscode.window.setStatusBarMessage('虎扑摸鱼助手已激活', 5000);
	// 初始化步行街
	new BxjTreeView(context);
	// 初始化赛事日程
	new NBATreeView(context);
	// 初始化命令
	new IndexCommands(context);
}

// 插件销毁
export function deactivate() {
	vscode.window.setStatusBarMessage('虎扑摸鱼助手已销毁', 5000);
}
