import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {sendPayslipLine} from '../src/payroll-delivery.js';import {payslipRowsHtml} from '../public/payslip-delivery.js';
let checks=0;const check=(value,msg)=>{assert.ok(value,msg);checks++;};
const source=readFileSync('src/index.js','utf8');
const shared=source.slice(source.indexOf('const LINE_CI = {'),source.indexOf('function leavePolicyIcon('));
const start=source.indexOf('function buildPayslipReadyFlex('),builder=source.slice(start,source.indexOf('\nasync function publishPayrollPeriod',start));
const context={displayName:employee=>employee.nickname||employee.first_name||'พนักงาน'};vm.createContext(context);vm.runInContext(shared+builder,context);
// Use the production card builder and its real shared layout helpers, not a stub.
const card=context.buildPayslipReadyFlex({id:1,nickname:'พนักงานทดสอบ'},{period_key:'2026-10'},12345.67,'https://nakna.example/payslip/private');
check(card.type==='flex'&&card.contents.type==='bubble','complete Flex envelope wraps bubble');
check(card.altText.includes('2026-10')&&card.altText.length<=400,'notification fallback present');
check(card.contents.footer.contents[0].action.uri==='https://nakna.example/payslip/private','own slip URL preserved');
const original=globalThis.fetch;let calls=0,captured;
try{
 globalThis.fetch=async(url,options)=>{calls++;captured=JSON.parse(options.body);return new Response('',{status:200});};
 await assert.rejects(()=>sendPayslipLine('token','user',[card.contents],'key'),error=>error.code==='LINE_PAYLOAD_INVALID');check(calls===0,'old bare-bubble defect rejected before network');
 check(await sendPayslipLine('token','user',[card],'key'),'production card passes transport validation');check(captured.messages[0].type==='flex'&&captured.messages[0].contents.type==='bubble','actual outgoing request has required nesting');
 for(const [status,body,expected] of [[401,{},'LINE_TOKEN_INVALID'],[403,{},'LINE_FORBIDDEN'],[429,{message:'You have reached your monthly limit.'},'LINE_MONTHLY_LIMIT'],[429,{message:'Too many requests'},'LINE_RATE_LIMIT'],[503,{},'LINE_UNAVAILABLE'],[400,{details:[{property:'messages[0].contents'}]},'LINE_PAYLOAD_INVALID'],[400,{message:'The property, to, in the request body is invalid'},'LINE_RECIPIENT_INVALID'],[400,{message:'unknown invalid value'},'LINE_REQUEST_INVALID']]){
  globalThis.fetch=async()=>Response.json({...body,secret:'must-not-leak'},{status});
  await assert.rejects(()=>sendPayslipLine('token','user',[card],'key'),error=>error.code===expected&&!error.message.includes('must-not-leak'));
  check(true,'safe provider diagnostic '+expected);
  const html=payslipRowsHtml([{employee_id:1,name:'ทดสอบ',line_connected:true,status:'failed',error_code:expected}]);check(!html.includes('must-not-leak')&&html.includes('<small>'),'Thai diagnostic displayed without provider payload');
 }
 globalThis.fetch=async()=>{throw Error('network secret');};await assert.rejects(()=>sendPayslipLine('token','user',[card],'key'),error=>error.code==='LINE_NETWORK_ERROR');check(true,'network error classified without raw contents');
 globalThis.fetch=async()=>{const error=new Error('timeout');error.name='AbortError';throw error;};await assert.rejects(()=>sendPayslipLine('token','user',[card],'key'),error=>error.code==='LINE_TIMEOUT');check(true,'timeout distinguished');
}finally{globalThis.fetch=original;}
console.log(`P10.30 payslip format: ${checks} checks PASS (production builder and mock LINE transport)`);
