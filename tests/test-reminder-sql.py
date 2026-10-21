#!/usr/bin/env python3
"""Offline SQLite contract smoke test for reminder eligibility and idempotency.
No real accounts, line messages, or network operations.
"""
import re, sqlite3, sys, pathlib
source=pathlib.Path(sys.argv[1]).read_text()
start=source.index('async function runMissingCheckinReminderAutomation(env){')
end=source.index('function safeJsonParse(value,fallback=null)',start)
body=source[start:end]
match=re.search(r'const result=await env\.DB\.prepare\(`([\s\S]*?)`\)\.bind\(lastEmployeeId,today,weekday,fallbackWorkday,MISSING_CHECKIN_REMINDER_TIME,MISSING_CHECKIN_REMINDER_DEFAULT_MESSAGE\)\.all\(\);',body)
assert match, 'missing SQL'
query=match.group(1)
c=sqlite3.connect(':memory:')
c.executescript('''
CREATE TABLE clients (id INTEGER PRIMARY KEY,attendance_reminder_enabled INTEGER,attendance_reminder_message TEXT,work_start TEXT);
CREATE TABLE employees (id INTEGER PRIMARY KEY,client_id INTEGER,status TEXT,people_status TEXT,line_user_id TEXT,line_provider_scope TEXT,department_id INTEGER);
CREATE TABLE attendance (client_id INTEGER,employee_id INTEGER,work_date TEXT,check_in_at TEXT,status TEXT);
CREATE TABLE leave_requests (client_id INTEGER,employee_id INTEGER,status TEXT,start_date TEXT,end_date TEXT);
CREATE TABLE company_holidays (client_id INTEGER,holiday_date TEXT,name TEXT);
CREATE TABLE work_schedule_rules (client_id INTEGER,weekday INTEGER,scope_type TEXT,scope_id INTEGER,is_workday INTEGER,start_time TEXT);
CREATE TABLE attendance_reminder_logs(client_id INTEGER,employee_id INTEGER,reminder_date TEXT,status TEXT,UNIQUE(client_id,employee_id,reminder_date));
''')
c.execute('INSERT INTO clients VALUES (1,1,NULL,\'09:00\')')
for i in range(1,8): c.execute('INSERT INTO employees VALUES (?,1,\'active\',\'employee\',?,?,NULL)',(i,'U'+str(i),'default'))
c.execute('INSERT INTO attendance VALUES (1,2,\'2026-10-22\',\'09:00\',\'present\')')
c.execute('INSERT INTO leave_requests VALUES (1,3,\'approved\',\'2026-10-22\',\'2026-10-22\')')
c.execute('INSERT INTO leave_requests VALUES (1,4,\'pending\',\'2026-10-22\',\'2026-10-22\')')
c.execute('INSERT INTO attendance_reminder_logs VALUES(1,5,\'2026-10-22\',\'sent\')')
c.execute('INSERT INTO attendance_reminder_logs VALUES(1,6,\'2026-10-22\',\'retry\')')
c.execute("INSERT INTO work_schedule_rules VALUES(1,4,'employee',7,1,'14:00')")
params=[0,'2026-10-22',4,1,'12:30','test text']
rows=c.execute(query,params).fetchall()
ids=[x[0] for x in rows]
assert ids==[1,6],f'Expected 1 and retry 6; found {ids}'
checks=1
# Holiday blocks all employees for that workspace.
c.execute("INSERT INTO company_holidays VALUES(1,'2026-10-22','holiday')")
assert c.execute(query,params).fetchall()==[], 'holiday filter failed';checks+=1
c.execute('DELETE FROM company_holidays')
# Company reminder disabled blocks all.
c.execute('UPDATE clients SET attendance_reminder_enabled=0 WHERE id=1')
assert c.execute(query,params).fetchall()==[], 'disabled filter failed';checks+=1
c.execute('UPDATE clients SET attendance_reminder_enabled=1 WHERE id=1')
# Idempotent claim proof with unique key and status.
c.execute('INSERT OR IGNORE INTO attendance_reminder_logs VALUES(1,1,\'2026-10-22\',\'pending\')')
c.execute('INSERT OR IGNORE INTO attendance_reminder_logs VALUES(1,1,\'2026-10-22\',\'pending\')')
assert c.execute("SELECT COUNT(*) FROM attendance_reminder_logs WHERE employee_id=1").fetchone()[0]==1,'unique log failed';checks+=1
print(f'P10.10 SQLite eligibility: {checks}/{checks} PASS')
