import * as vscode from 'vscode';
import NBATreeView from './treeView/nba';
import BxjTreeView from './webview/bxj';
import PostDetailWebView from './webview/postDetail';
import LiveStudioWebView from './webview/liveStudio';
import BoxscoreWebView from './webview/boxscore';
import StandingsWebView from './webview/standings';
import IndexCommands from './commands';

// 插件激活
export function activate(context: vscode.ExtensionContext) {
	vscode.window.setStatusBarMessage('虎扑摸鱼助手已激活', 5000);
	// 初始化步行街
	new BxjTreeView(context);
	// 初始化赛事日程
	new NBATreeView(context);
	// 初始化命令
	new IndexCommands(context);
	// 快速切换回工作模式
	const bossComing = vscode.commands.registerCommand('hupumoyu.bossComing', (e: { extensionId: string }) => {
		// 关闭数据统计
		BoxscoreWebView.forceCloseWebview();
		// 关闭直播间
		LiveStudioWebView.forceCloseWebview();
		// 关闭步行街打开的帖子
		PostDetailWebView.forceCloseWebview();
		// 关闭数据排行
		StandingsWebView.forceCloseWebview();
		// 如果左侧的板块的可见的，则切换到资源管理器界面
		if (NBATreeView?._treeView?.visible || BxjTreeView?._webView?.visible) {
			vscode.commands.executeCommand('workbench.view.explorer');
		}
	});
	context.subscriptions.push(bossComing);
}

// 插件销毁
export function deactivate() {
	vscode.window.setStatusBarMessage('虎扑摸鱼助手已销毁', 5000);
}
