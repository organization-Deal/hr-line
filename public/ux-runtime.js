// Coalesce identical concurrent reads only. Never retain completed HR data.
const SHARED_READS = new Set(['/api/dashboard','/api/employees','/api/people-core','/api/lookups','/api/company-profile','/api/leave-policies','/api/work-locations']);
export function createReadGate() {
  const pending = new Map();
  let generation = 0;
  const copy = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  return {
    run(path, options, scope, request) {
      const method = String(options.method || 'GET').toUpperCase();
      if (!['GET','HEAD','OPTIONS'].includes(method)) { generation++; pending.clear(); return request(); }
      if (method !== 'GET' || !SHARED_READS.has(path) || Object.keys(options).some(k => !['method','timeoutMs','silentStatus'].includes(k))) return request();
      const key = JSON.stringify([scope,generation,path,Number(options.timeoutMs || 18000),Boolean(options.silentStatus)]);
      let task = pending.get(key);
      if (!task) {
        task = Promise.resolve().then(request);
        pending.set(key, task);
        const clear = () => { if (pending.get(key) === task) pending.delete(key); };
        task.then(clear, clear);
      }
      return task.then(copy);
    }
  };
}

export function shouldPreloadPeople({hidden, mobile, connection, currentView, busy}) {
  return !hidden && !mobile && !busy && currentView === 'dashboard' && !connection?.saveData && !['slow-2g','2g'].includes(connection?.effectiveType);
}

export function resetRoutePosition(win, doc) {
  // Smooth scrolling can race with page height changes and leave the new view
  // halfway down. Reset only the page containers; retain nested table positions.
  win.scrollTo({top:0,left:0,behavior:'instant'});
  if (doc.scrollingElement) doc.scrollingElement.scrollTop = 0;
  const main = doc.getElementById('nkMain');
  if (main) main.scrollTop = 0;
}
