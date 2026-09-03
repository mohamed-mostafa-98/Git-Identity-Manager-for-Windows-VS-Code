import { contextBridge, ipcRenderer } from 'electron';

const invoke = async (name: string, ...args: unknown[]) => {
    const result = await ipcRenderer.invoke(`identity:${name}`, ...args);
    if (!result.ok) throw new Error(result.error);
    return result.value;
};
contextBridge.exposeInMainWorld('identity', {
    connections: () => invoke('connections'),
    extensionAction: (connection: string, request: unknown) => invoke('extensionAction', connection, request),
    snapshot: () => invoke('snapshot'),
    addAccount: (input: unknown) => invoke('addAccount', input),
    addProject: () => invoke('addProject'),
    assign: (projectId: string, accountId: string | null) => invoke('assign', projectId, accountId),
    remove: (kind: string, id: string) => invoke('remove', kind, id),
    context: (projectId: string) => invoke('context', projectId)
});
