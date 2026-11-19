import joplin from 'api';
import { ContentScriptType, MenuItemLocation } from 'api/types';
import demoNote from './demoNote.generated';

// Snippets inserted at the cursor by the Tools → Hue MD menu.
const SNIPPETS: { name: string; label: string; text: string }[] = [
	{
		name: 'hueMd.insertInfoBox',
		label: 'Insert info box',
		text: '\n+-- info Title\n| Your note here\n+--\n',
	},
	{
		name: 'hueMd.insertWarnBox',
		label: 'Insert warning box',
		text: '\n+-- warn Heads up\n| Something to watch\n+--\n',
	},
	{
		name: 'hueMd.insertSplitBoxes',
		label: 'Insert side-by-side boxes',
		text: '\n+-- ok Do this                 +-- warn Avoid this\n| Keep it readable.            | Raw HTML in notes.\n+--                            +--\n',
	},
	{
		name: 'hueMd.insertTaskList',
		label: 'Insert task list',
		text: '\n- [ ] To do\n- [-] In progress\n- [!] Blocked\n- [?] Question\n- [x] Done\n',
	},
	{
		name: 'hueMd.insertProgress',
		label: 'Insert progress bar',
		text: '[======....] 60%',
	},
	{
		name: 'hueMd.insertKeyCap',
		label: 'Insert key cap',
		text: '[[Ctrl+C]]',
	},
	{
		name: 'hueMd.insertColorSpan',
		label: 'Insert colored text',
		text: '{ok: text}',
	},
];

joplin.plugins.register({
	onStart: async function() {
		// Hue MD rendering in the note viewer: registers the Hue markdown-it plugin
		// and its stylesheet. See contentScript.js.
		await joplin.contentScripts.register(
			ContentScriptType.MarkdownItPlugin,
			'hue-md',
			'./contentScript.js',
		);

		await joplin.commands.register({
			name: 'hueMd.newDemoNote',
			label: 'New Hue MD demo note',
			execute: async () => {
				const folder = await joplin.workspace.selectedFolder();
				const note = await joplin.data.post(['notes'], null, {
					title: 'Hue MD demo',
					body: demoNote,
					parent_id: folder ? folder.id : undefined,
				});
				await joplin.commands.execute('openNote', note.id);
			},
		});

		for (const s of SNIPPETS) {
			await joplin.commands.register({
				name: s.name,
				label: s.label,
				execute: async () => {
					await joplin.commands.execute('insertText', s.text);
				},
			});
		}

		await joplin.views.menus.create('hueMdToolsMenu', 'Hue MD', [
			{ commandName: 'hueMd.newDemoNote' },
			...SNIPPETS.map(s => ({ commandName: s.name })),
		], MenuItemLocation.Tools);
	},
});
