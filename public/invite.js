const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
let invite = null;

function show(id) {
  ['loadingState','errorState','formState','successState'].forEach(key => $(`#${key}`).classList.toggle('hidden', key !== id));
}

async function loadInvite() {
  if (!token) return fail('ไม่พบรหัสลิงก์เชิญ');
  try {
    const res = await fetch(`/api/public/invites/${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return fail(data.error === 'INVITE_EXPIRED' ? 'ลิงก์นี้หมดอายุหรือถูกใช้ครบแล้ว กรุณาขอลิงก์ใหม่จาก HR' : 'ไม่พบลิงก์เชิญนี้');
    invite = data.invite;
    $('#companyName').textContent = invite.company_name;
    $('#contextCompany').textContent = invite.company_name;
    $('#contextPosition').textContent = invite.position_name || 'ไม่ระบุ';
    $('#contextDepartment').textContent = invite.department_name || 'ไม่ระบุ';
    $('#contextStart').textContent = invite.start_date ? formatDate(invite.start_date) : 'ตามที่ HR กำหนด';
    $('#contextLocations').textContent = invite.locations?.length ? invite.locations.map(item => item.name).join(', ') : 'ทุก Location ของบริษัท';
    show('formState');
  } catch (error) { fail('เปิดลิงก์เชิญไม่สำเร็จ กรุณาลองใหม่'); }
}

function fail(message) { $('#errorText').textContent = message; show('errorState'); }

$('#employeeForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!$('#confirmCheck').checked) return;
  const button = $('#submitBtn');
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  button.disabled = true;
  button.textContent = 'กำลังสร้างโปรไฟล์…';
  try {
    const res = await fetch(`/api/public/invites/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'สร้างโปรไฟล์ไม่สำเร็จ');
    $('#resultName').textContent = result.employee.name;
    $('#resultCompany').textContent = `${result.employee.company_name} · ${result.employee.employee_code}`;
    $('#lineCommand').textContent = result.line_command;
    if (result.line_connect_url) {
      $('#lineConnectBtn').href = result.line_connect_url;
    } else {
      $('#lineConnectBtn').addEventListener('click', event => {
        event.preventDefault();
        $('#fallbackBox').open = true;
      }, { once: true });
      $('#lineConnectBtn').textContent = 'ดูวิธีเชื่อม LINE';
    }
    show('successState');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'ยืนยันและสร้างโปรไฟล์พนักงาน';
  }
});

$('#copyCommandBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#lineCommand').textContent);
    $('#copyCommandBtn').textContent = 'คัดลอกแล้ว';
  } catch {}
});

function formatDate(value) {
  const d = new Date(`${String(value).slice(0,10)}T00:00:00+07:00`);
  return d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Bangkok' });
}

loadInvite();
