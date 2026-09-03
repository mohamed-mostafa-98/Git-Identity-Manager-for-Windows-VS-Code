'use strict';
let state = { accounts: [], projects: [] };
const $ = selector => document.querySelector(selector);
const element = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
};
const button = (label, className, action) => {
    const node = element('button', className, label);
    node.addEventListener('click', () => run(action));
    return node;
};
async function run(action) {
    $('#notice').hidden = true;
    try { await action(); }
    catch (error) { $('#notice').textContent = error.message || 'Something went wrong. Please retry.'; $('#notice').hidden = false; }
}
function view(id) {
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== id; });
    document.querySelectorAll('.nav-button').forEach(node => { node.classList.toggle('active', node.dataset.view === id); node.setAttribute('aria-current', node.dataset.view === id ? 'page' : 'false'); });
    $('#breadcrumb-view').textContent = id === 'agents' ? 'Agent access' : id[0].toUpperCase() + id.slice(1);
}
function empty(title, description, actionText, action) {
    const node = element('div', 'empty');
    node.append(element('div', 'empty-icon', '↗'), element('h3', '', title), element('p', '', description));
    if (action) node.append(button(actionText, 'quiet', action));
    return node;
}
async function addProject() { state = await window.identity.addProject(); render(); }
function addAccount() { $('#account-form').reset(); $('#form-error').textContent = ''; $('#account-dialog').showModal(); }
async function context(projectId) {
    const data = await window.identity.context(projectId);
    $('#context-output').textContent = JSON.stringify(data, null, 2);
    $('#state-file').textContent = state.stateFile;
    $('#context-dialog').showModal();
}
function projectList(editable, agent = false) {
    if (!state.projects.length) return empty('Make room for your first project', 'Add a local GitHub repository, then choose the account it belongs to.', '+ Add project', addProject);
    const list = element('div', 'project-table');
    for (const project of state.projects) {
        const row = element('div', 'project-row');
        const details = element('div');
        details.append(element('div', 'project-name', project.name), element('div', 'project-path', project.rootPath));
        const account = state.accounts.find(a => a.id === project.accountId);
        const identity = element('div', 'project-account');
        if (editable) {
            const select = element('select');
            select.setAttribute('aria-label', `Account for ${project.name}`);
            const unassigned = element('option', '', 'Choose an account'); unassigned.value = ''; select.append(unassigned);
            for (const item of state.accounts) { const option = element('option', '', `${item.displayName} (@${item.githubUsername})`); option.value = item.id; select.append(option); }
            select.value = project.accountId || '';
            select.addEventListener('change', () => run(async () => { state = await window.identity.assign(project.id, select.value || null); render(); }));
            identity.append(select);
        } else identity.append(element('span', account ? '' : 'pill', account ? `@${account.githubUsername}` : 'Unassigned'));
        identity.append(element('small', '', 'Desktop login not connected'));
        const actions = element('div', 'project-actions');
        if (agent || editable) actions.append(button('Agent context', 'quiet', () => context(project.id)));
        if (editable) actions.append(button('Remove', 'text-button', async () => { state = await window.identity.remove('project', project.id); render(); }));
        if (!editable && !agent) actions.append(button('Manage →', 'text-button', () => view('projects')));
        row.append(details, identity, actions); list.append(row);
    }
    return list;
}
function render() {
    for (const selector of ['#stat-accounts', '#nav-accounts']) $(selector).textContent = state.accounts.length;
    for (const selector of ['#stat-projects', '#nav-projects']) $(selector).textContent = state.projects.length;
    $('#stat-assigned').textContent = state.projects.filter(p => p.accountId).length;
    $('#overview-projects').replaceChildren(projectList(false));
    $('#project-list').replaceChildren(projectList(true));
    $('#agent-projects').replaceChildren(projectList(false, true));
    const cards = state.accounts.map(account => {
        const card = element('article', 'account-card');
        card.append(element('div', 'account-avatar', account.displayName.slice(0, 2).toUpperCase()), element('h2', '', account.displayName), element('p', '', `@${account.githubUsername}`), element('p', '', account.githubEmail));
        const bottom = element('div', 'card-bottom');
        bottom.append(element('span', 'pill', 'Login not connected'), button('Remove', 'text-button', async () => { state = await window.identity.remove('account', account.id); render(); }));
        card.append(bottom); return card;
    });
    $('#account-list').replaceChildren(...(cards.length ? cards : [empty('One workspace. All your identities.', 'Start with your personal or work GitHub account. Only profile details are saved here.', '+ Add account', addAccount)]));
}
document.querySelectorAll('[data-view]').forEach(node => node.addEventListener('click', () => view(node.dataset.view)));
document.querySelectorAll('.add-project').forEach(node => node.addEventListener('click', () => run(addProject)));
document.querySelectorAll('.add-account').forEach(node => node.addEventListener('click', addAccount));
document.querySelectorAll('.close-dialog').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
$('#account-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = event.submitter;
    submit.disabled = true;
    try {
        state = await window.identity.addAccount(Object.fromEntries(new FormData(event.currentTarget)));
        $('#account-dialog').close(); render();
    } catch (error) { $('#form-error').textContent = error.message; }
    finally { submit.disabled = false; }
});
$('#refresh').addEventListener('click', () => run(async () => { state = await window.identity.snapshot(); render(); }));
run(async () => { state = await window.identity.snapshot(); render(); });
