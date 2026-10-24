// Shared validation for public onboarding. Never accepts salary or payroll settings.
export function invitePayrollFields(body={}){
 const national_id=String(body.national_id||'').replace(/[\s-]/g,'');
 const bank_name=String(body.bank_name||'').trim(),bank_account_name=String(body.bank_account_name||'').trim();
 const bank_account_no=String(body.bank_account_no||'').replace(/[\s-]/g,'');
 if(national_id&&!/^\d{13}$/.test(national_id))throw Error('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
 if(bank_name.length>100||bank_account_name.length>150)throw Error('ชื่อธนาคารหรือชื่อบัญชียาวเกินกำหนด');
 const hasBank=Boolean(bank_name||bank_account_name||bank_account_no);
 if(hasBank&&(!bank_name||!bank_account_name||!bank_account_no))throw Error('กรอกธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ หรือเว้นว่างทั้งสามช่องเพื่อให้ HR เติมภายหลัง');
 if(bank_account_no&&!/^\d{6,20}$/.test(bank_account_no))throw Error('เลขบัญชีต้องเป็นตัวเลข 6–20 หลัก');
 return {national_id:national_id||null,bank_name:bank_name||null,bank_account_name:bank_account_name||null,bank_account_no:bank_account_no||null,hasBank};
}
