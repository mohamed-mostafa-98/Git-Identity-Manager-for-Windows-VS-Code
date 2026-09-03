'use strict';
const api = window.identity;
const $ = selector => document.querySelector(selector);
let connection = '';
let state;
let view = 'accounts';
let busy = false;
const node = (tag, text, className) => {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
};
const notice = text => { $('#notice').textContent = text; $('#notice').hidden = !text; };
function button(text, action, id) {
    const element = node('button', text, 'quiet');
    element.dataset.action = action;
    if (id) element.dataset.id = id;
    return element;
}
function render() {
    $('#disconnected').hidden = !!state;
    for (const section of ['accounts', 'projects', 'tools']) $(`#${section}`).hidden = !state || section !== view;
    document.querySelectorAll('[data-view]').forEach(element => element.classList.toggle('active', element.dataset.view === view));
    $('#account-list').replaceChildren(); $('#mapping-list').replaceChildren();
    if (state) {
        for (const profile of state.profiles) {
            const card = node('article', '', 'account-card');
            card.append(node('h2', profile.displayName), node('p', `@${profile.githubUsername} · ${profile.githubEmail}`),
                node('span', ({ BROWSER_OAUTH: 'Browser login', HTTPS: 'HTTPS / token', SSH: 'SSH key', GITHUB_CLI: 'GitHub CLI' })[profile.authenticationMethod] || profile.authenticationMethod, 'pill'));
            if (profile.id === state.activeProfileId) card.append(node('p', 'Active in this VS Code window', 'green'));
            const actions = node('div', '', 'card-bottom');
            actions.append(button('Use for workspace', 'switchProfile', profile.id), button('Remove', 'removeProfile', profile.id));
            card.append(actions);
            if (['HTTPS', 'BROWSER_OAUTH'].includes(profile.authenticationMethod)) card.append(button('Update token…', 'saveToken', profile.id));
            $('#account-list').append(card);
        }
        if (!state.profiles.length) $('#account-list').append(node('p', 'No profiles yet. Sign in with your browser to add one.', 'empty'));
        for (const mapping of state.mappings) {
            const row = node('div', '', 'project-row');
            const info = node('div', '');
            info.append(node('div', mapping.pattern, 'project-name'), node('small', mapping.isPathPattern ? 'Folder rule' : 'Repository / owner rule', 'project-path'));
            row.append(info, node('span', state.profiles.find(p => p.id === mapping.profileId)?.displayName || 'Missing account', 'project-account'), button('Remove', 'removeMapping', mapping.id));
            $('#mapping-list').append(row);
        }
        if (!state.mappings.length) $('#mapping-list').append(node('p', 'No project mappings yet.', 'empty'));
        $('#folders').textContent = state.folders.join('\n') || 'No folder open';
        $('#connection-status').textContent = state.trusted ? 'Connected · Changes appear in both views.' : 'Connected · Trust the workspace in VS Code to enable changes.';
    }
    document.querySelectorAll('[data-action]').forEach(element => { element.disabled = busy || !state?.trusted; });
    $('#connection').disabled = busy;
    $('#refresh').disabled = busy;
}
async function refreshConnections() {
    if (busy) return;
    busy = true; render();
    try {
        const rows = await api.connections();
        $('#connection').replaceChildren(node('option', 'Choose a VS Code window'));
        $('#connection').firstChild.value = '';
        for (const row of rows) { const option = node('option', row.label); option.value = row.id; $('#connection').append(option); }
        if (!rows.some(row => row.id === connection)) connection = rows.length === 1 ? rows[0].id : '';
        $('#connection').value = connection;
        state = connection ? await api.extensionAction(connection, { action: 'snapshot' }) : undefined;
        if (!state) $('#connection-status').textContent = rows.length ? 'Choose the VS Code window to control.' : 'VS Code is not connected.';
    } catch (error) { state = undefined; notice(error.message); }
    finally { busy = false; render(); }
}
async function act(action, id) {
    if (busy || !connection) return;
    busy = true; render(); notice('Complete any login or confirmation prompts in VS Code.');
    try {
        state = await api.extensionAction(connection, id ? { action, id } : { action });
        notice('View refreshed from VS Code.');
    } catch (error) { notice(error.message); }
    finally { busy = false; render(); }
}
document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.view) { view = target.dataset.view; render(); }
    if (target.dataset.action) void act(target.dataset.action, target.dataset.id);
});
$('#refresh').addEventListener('click', () => { notice(''); void refreshConnections(); });
$('#connection').addEventListener('change', () => { connection = $('#connection').value; void refreshConnections(); });
// Refresh on return and periodically so extension-side changes need no manual import.
window.addEventListener('focus', () => { if (!busy) void refreshConnections(); });
setInterval(() => { if (!busy && !document.hidden) void refreshConnections(); }, 5000);
void refreshConnections();
