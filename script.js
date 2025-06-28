// [최종 완성본 - JS 파일 분리 및 모든 오류 해결]

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyI4mbZxNrweVJOd-Pn29xDakH7ibzs_v0XqqcdQdR7AzoNlAsnYRYDE1ui9nzObJai/exec'; // ✨ 배포된 Apps Script 웹 앱 URL을 여기에 붙여넣으세요!
const GOOGLE_CLIENT_ID = '190435721099-45et34v9elbvod5lb84ddakrnenh5039.apps.googleusercontent.com';
let currentUser = null;
let completedItems = {};
const urlParams = new URLSearchParams(window.location.search);
const isTeacherMode = urlParams.get('mode') === 'teacher';

window.onload = function () {
    loadCompletedItems();
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredentialResponse });
    const storedUser = localStorage.getItem('userInfo');
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser);
            renderUserInfo(currentUser);
            loadData();
        } catch (e) {
            console.error("저장된 사용자 정보 파싱 오류:", e);
            localStorage.removeItem('userInfo');
            location.reload();
        }
    } else {
        google.accounts.id.renderButton(document.getElementById("gsi-container"), { theme: "outline", size: "large" });
        const targetEl = isTeacherMode ? document.getElementById('teacher-dashboard') : document.getElementById('student-portal');
        targetEl.style.display = 'block';
        if (isTeacherMode) targetEl.innerHTML = '<div class="empty-state">교사 계정으로 로그인해주세요.</div>';
    }
    updateDateDisplay();
    setupEventListeners();
};

async function handleCredentialResponse(response) {
    const userObject = JSON.parse(atob(response.credential.split('.')[1]));
    currentUser = { name: userObject.name, email: userObject.email, picture: userObject.picture };
    localStorage.setItem('userInfo', JSON.stringify(currentUser));
    location.reload();
}

async function loadData() {
    const targetEl = isTeacherMode ? document.getElementById('teacher-dashboard') : document.getElementById('student-portal');
    targetEl.style.display = 'block';
    targetEl.innerHTML = '<div class="empty-state">🔄 데이터를 불러오는 중...</div>';
    let fullUrl = `${SCRIPT_URL}?v=${new Date().getTime()}`;
    document.getElementById('portal-title').textContent = isTeacherMode ? '🎓 교사 통합 대시보드' : '📢 오늘의 알림';
    if (isTeacherMode) fullUrl += '&mode=teacher';
    if (currentUser) fullUrl += `&email=${encodeURIComponent(currentUser.email)}`;
    try {
        const response = await fetch(fullUrl);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        currentUser = { ...currentUser, ...data.user };
        localStorage.setItem('userInfo', JSON.stringify(currentUser));
        renderUserInfo(currentUser);
        if (isTeacherMode) { renderTeacherDashboard(data); } 
        else { renderStudentPortal(data); }
    } catch (error) {
        console.error('Error:', error);
        targetEl.innerHTML = `<div class="empty-state">❌ 데이터 로드 실패: ${error.message}</div>`;
    }
}

function renderUserInfo(user) {
    const displayEl = document.getElementById('user-display');
    const gsiContainer = document.getElementById('gsi-container');
    if(!displayEl || !gsiContainer) return;
    
    displayEl.style.display = 'flex';
    gsiContainer.style.display = 'none';

    let userInfoHtml;
    if (user.picture) {
        userInfoHtml = `<div class="user-display"><img src="${user.picture}" class="user-profile-image" alt="profile"><div class="user-name-logout"><strong>${user.name}</strong><a href="#" onclick="handleLogout()">로그아웃</a></div></div>`;
    } else {
        const initial = user.name.charAt(0).toUpperCase();
        const colors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#e67e22', '#e74c3c', '#1abc9c'];
        const color = colors[user.name.charCodeAt(0) % colors.length];
        userInfoHtml = `<div class="user-display"><div class="user-initial" style="background-color: ${color};">${initial}</div><div class="user-name-logout"><strong>${user.name}</strong><a href="#" onclick="handleLogout()">로그아웃</a></div></div>`;
    }
    
    displayEl.innerHTML = userInfoHtml;
    if (!isTeacherMode && !user.studentId) {
        displayEl.innerHTML += `<span style="color: #ffc107; font-size: 0.9em; margin-left: 10px;">(미등록)</span>`;
    }
}

function renderTeacherDashboard(data) {
    const dashboard = document.getElementById('teacher-dashboard');
    dashboard.innerHTML = `<div id="routine-tasks-section" class="section"></div><div id="class-management-section" class="section"></div><div id="teacher-personal-tasks-section" class="section"></div><div id="teacher-class-schedules-section" class="section"></div><div id="teacher-settings-section" class="section"></div>`;
    renderTeacherRoutines(data.routines);
    renderClassManagementAccordions(data);
    renderTeacherPersonalTasks(data.teacherPersonalTasks);
    renderTeacherClassSchedules(data.classSchedules);
    renderTeacherSettings(data.dashboardItems, data.sheetUrl);
    setupAccordionListeners();
}

function renderClassManagementAccordions(data) {
    const container = document.getElementById('class-management-section');
    container.innerHTML = `<h2 class="section-title"><span class="icon">🏠</span>학급 관리</h2>
        <div id="leave-accordion"></div><div id="assignment-accordion"></div><div id="notice-status-accordion"></div>`;
    const leaves = data.pendingLeaveRequests || [];
    let leavesHtml = '<div class="empty-state">신청 내역이 없습니다.</div>';
    if (leaves.length > 0) {
        leavesHtml = leaves.map(req => `<div class="teacher-leave-card"><div class="leave-header"><strong>${req.이름} (${req.학번})</strong><small>${req.신청종류} (${new Date(req.희망일자).toLocaleDateString()})</small></div><div class="leave-reason">사유: ${req.사유}</div><div class="leave-actions"><input type="text" class="leave-comment-input" id="comment-${req.rowNum}" placeholder="코멘트 (선택 사항)"><button class="action-btn approve-btn" onclick="updateLeaveStatus(${req.rowNum}, '승인', 'comment-${req.rowNum}')">승인</button><button class="action-btn reject-btn" onclick="updateLeaveStatus(${req.rowNum}, '반려', 'comment-${req.rowNum}')">반려</button></div></div>`).join('');
    }
    document.getElementById('leave-accordion').innerHTML = `<div class="accordion-title active"><span>⏰ 외출/조퇴 신청</span><span class="count">${leaves.length}건</span></div><div class="accordion-content" style="display: block;">${leavesHtml}</div>`;
    const assignments = data.assignments || [];
    let assignmentsHtml = '<div class="empty-state">관리할 과제가 없습니다.</div>';
    if (assignments.length > 0) {
        assignmentsHtml = assignments.map(a => `<div class="assignment-card" id="${a.id}"><button class="teacher-complete-btn" title="목록에서 숨기기" onclick="completeItem('${a.id}', true, ${a.rowNum}, '[데이터_알림]')">✖</button><div class="card-title">${a.title}</div><div class="assignment-actions">${(a.assignmentType === '단일제출') ? `<button class="action-btn check-btn" onclick="checkUnsubmitted(event, '${a.taskId}', '${a.title}', '${a.studentIdColumn}')">미제출자</button>` : ''}${a.responseSheetUrl ? `<a href="${a.responseSheetUrl}" target="_blank" class="action-btn response-btn">관리</a>` : ''}</div></div>`).join('');
    }
    document.getElementById('assignment-accordion').innerHTML = `<div class="accordion-title"><span>📝 과제별 제출 현황</span><span class="count">${assignments.length}건</span></div><div class="accordion-content">${assignmentsHtml}</div>`;
    const allPosts = [...(data.allNotices || []), ...(data.allTasks || [])];
    const totalPosts = allPosts.length;
    let postsHtml = '<div class="empty-state">게시된 알림/할 일이 없습니다.</div>';
    if (totalPosts > 0) {
        postsHtml = allPosts.map(item => {
            const period = (item.startDate && item.endDate) ? `${new Date(item.startDate).toLocaleDateString()} ~ ${new Date(item.endDate).toLocaleDateString()}` : '상시';
            const target = item.대상학생 ? '특정 학생' : '전체';
            return `<div class="card" id="status-${item.id}" style="padding: 15px;"><button class="teacher-complete-btn" style="width:24px; height:24px; line-height:24px; font-size:14px;" title="게시 종료" onclick="completeItem('${item.id}', true, ${item.rowNum}, '[데이터_알림]')">✖</button><div class="card-title" style="font-size: 1.1em; margin-bottom: 5px;">${item.아이콘 || ''} ${item.제목}</div><p class="card-description" style="font-size: 0.9em; margin-bottom: 0;">${item.내용}</p><div class="status-card-info"><div>게시 기간: <span>${period}</span></div><div>대상: <span>${target}</span></div></div></div>`;
        }).join('');
    }
    document.getElementById('notice-status-accordion').innerHTML = `<div class="accordion-title"><span>📢 알림 포털 게시 현황</span><span class="count">${totalPosts}건</span></div><div class="accordion-content">${postsHtml}</div>`;
}

function renderTeacherPersonalTasks(tasks) {
    const container = document.getElementById('teacher-personal-tasks-section');
    if (!tasks || tasks.length === 0) {
        container.style.display = 'none';
        return;
    }
    let tasksHtml = tasks.map(task => `
        <div class="personal-task-card card" id="personal-task-${task.rowNum}">
            <button class="complete-btn" title="완료" onclick="completePersonalTask('${task.rowNum}')">✔</button>
            <div class="card-title">${task.내용}</div>
            ${task.마감일 ? `<p class="card-description">마감: ${task.마감일}</p>` : ''}
            ${task.링크 ? `<a href="${task.링크}" target="_blank" class="action-btn" style="background-color: #007bff; margin-top: 10px; width: fit-content;">바로가기</a>` : ''}
        </div>`).join('');

    container.innerHTML = `<h2 class="section-title"><span class="icon">📋</span>업무 일지</h2>
        <div id="personal-task-accordion" class="accordion-title"><span>개인 업무 목록</span><span class="count">${tasks.length}건</span></div>
        <div class="accordion-content">${tasksHtml}</div>`;
}

function renderTeacherClassSchedules(schedules) {
    const container = document.getElementById('teacher-class-schedules-section');
    if (!schedules || schedules.length === 0) {
        container.style.display = 'none';
        return;
    }
    let schedulesHtml = schedules.map(schedule => `
        <div class="class-schedule-card card" id="schedule-${schedule.rowNum}">
            <button class="teacher-complete-btn" title="게시 종료" onclick="completeItem('schedule-${schedule.id}', true, ${schedule.rowNum}, '[데이터_학급일정]')">✖</button>
            <div class="card-title">${schedule.아이콘 || ''} ${schedule.제목}</div>
            <p class="card-description">기간: ${schedule['일정 시작일']} ~ ${schedule['일정 종료일']}</p>
            <p class="card-description">대상: ${schedule['대상 학생'] || '전체'}</p>
            ${schedule.내용 ? `<p class="card-description" style="font-size: 0.9em;">내용: ${schedule.내용}</p>` : ''}
            ${schedule.링크 ? `<a href="${schedule.링크}" target="_blank" class="action-btn" style="background-color: #007bff; margin-top: 10px; width: fit-content;">자세히 보기</a>` : ''}
        </div>`).join('');

    container.innerHTML = `<h2 class="section-title"><span class="icon">📅</span>학급 일정 관리</h2>
        <div id="class-schedule-accordion" class="accordion-title"><span>전체 학급 일정</span><span class="count">${schedules.length}건</span></div>
        <div class="accordion-content">${schedulesHtml}</div>`;
}

function initTabs(containerId) {
    const tabContainer = document.getElementById(containerId);
    if (!tabContainer) return;
    const tabButtons = tabContainer.querySelectorAll('.tab-button');
    const tabPanes = tabContainer.parentElement.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            const targetPane = document.getElementById(button.getAttribute('data-tab'));
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

function setupAccordionListeners() {
    document.querySelectorAll('.accordion-title').forEach(button => {
        button.addEventListener('click', () => {
            button.classList.toggle('active');
            const content = button.nextElementSibling;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
        });
    });
}

function renderStudentPortal(data) {
    const portal = document.getElementById('student-portal');
    portal.innerHTML = `
        <div id="widgets-container"></div>
        <div id="class-schedules-display" class="section" style="margin-top: 0; padding-top: 0;"></div>
        <div id="unsubmitted-container"></div>
        <div class="tabs" id="student-tabs">
            <button class="tab-button active" data-tab="student-tab-1">알림 & 할 일</button>
            <button class="tab-button" data-tab="student-tab-2" style="display:none;">외출/조퇴</button>
            <button class="tab-button" data-tab="student-tab-3">자료실</button>
        </div>
        <div class="tab-pane active" id="student-tab-1">
            <div id="notices"></div><div id="tasks" style="margin-top: 40px;"></div>
        </div>
        <div class="tab-pane" id="student-tab-2"><div id="leave-section"></div></div>
        <div class="tab-pane" id="student-tab-3"><div id="resources" class="teacher-dashboard-grid"></div></div>`;
    initTabs('student-tabs');
    
    const leaveTabButton = portal.querySelector('[data-tab="student-tab-2"]');
    if (data.user && data.user.studentId) {
        leaveTabButton.style.display = 'inline-block';
        renderLeaveRequests(data.leaveRequests);
    }
    
    renderWidgets(data.widgets);
    renderStudentClassSchedules(data.classSchedules);
    renderUnsubmitted(data.unsubmitted);
    renderItems('notices', data.notices.filter(item => !completedItems[item.id]), '📢 중요 공지');
    renderItems('tasks', data.tasks.filter(item => !completedItems[item.id]), '✅ 오늘의 할 일');
    renderResources(data.resources);
}

function renderStudentClassSchedules(schedules) {
    const container = document.getElementById('class-schedules-display');
    if (!schedules || schedules.length === 0) {
        container.style.display = 'none';
        return;
    }
    let schedulesHtml = schedules.map(schedule => {
        const displayDate = schedule['일정 시작일'] === schedule['일정 종료일'] ? schedule['일정 시작일'] : `${schedule['일정 시작일']} ~ ${schedule['일정 종료일']}`;
        const target = schedule['대상 학생'] || '전체';
        return `
        <div class="card" style="padding: 15px;">
            <div class="card-title">${schedule.아이콘 || ''} ${schedule.제목}</div>
            <p class="card-description" style="font-size: 0.9em; margin-bottom: 5px;">기간: ${displayDate}</p>
            ${schedule.내용 ? `<p class="card-description" style="font-size: 0.9em; margin-bottom: 5px;">내용: ${schedule.내용}</p>` : ''}
            <div style="font-size: 0.8em; color: var(--text-light);">대상: ${target}</div>
            ${schedule.링크 ? `<a href="${schedule.링크}" target="_blank" class="notice-link" style="padding: 8px 12px; margin-top: 10px; border-radius: 8px;">자세히 보기</a>` : ''}
        </div>`;
    }).join('');
    container.innerHTML = `<h2 class="section-title"><span class="icon">📅</span>다가오는 학급 일정</h2>${schedulesHtml}`;
}

function renderWidgets(widgets) {
    const container = document.getElementById('widgets-container');
    if (!widgets || widgets.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    container.innerHTML = widgets.map(widget => {
        let contentHtml = '';
        switch (widget.위젯종류) {
            case '디데이':
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dday = new Date(widget.내용);
                dday.setHours(0, 0, 0, 0);
                const diff = Math.ceil((dday - today) / (1000 * 60 * 60 * 24));
                contentHtml = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
                break;
            case '급식':
                contentHtml = `<div class="widget-content small-text" style="font-size: 1em; font-weight: normal;">${widget.내용.replace(/\n/g, '<br>')}</div>`;
                return `<div class="widget"><div class="widget-title">${widget.제목}</div>${contentHtml}</div>`;
            case '링크':
                contentHtml = `<a href="${widget.내용}" target="_blank" style="font-size: 1.2em; text-decoration: none; color: var(--primary-color);">바로가기</a>`;
                break;
            default: contentHtml = widget.내용;
        }
        return `<div class="widget"><div class="widget-title">${widget.제목}</div><div class="widget-content">${contentHtml}</div></div>`;
    }).join('');
}

function renderTeacherRoutines(routines) {
    const container = document.getElementById('routine-tasks-section');
    const today = new Date();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
    const todayRoutines = (routines || []).filter(r => {
        const conditions = (r.표시조건 || '').split(',').map(s => s.trim());
        return conditions.includes('매일') || conditions.includes(dayOfWeek) || (conditions.includes('주중') && !['토', '일'].includes(dayOfWeek)) || (conditions.includes('주말') && ['토', '일'].includes(dayOfWeek));
    });
    if (todayRoutines.length === 0) { container.style.display = 'none'; return; }
    const routineHtml = todayRoutines.map(r => `<label class="routine-item ${completedItems[r.id] ? 'completed' : ''}" id="${r.id}"><input type="checkbox" class="routine-checkbox" onchange="toggleRoutineComplete('${r.id}')" ${completedItems[r.id] ? 'checked' : ''}><span class="routine-label">${r.업무명}</span></label>`).join('');
    container.innerHTML = `<h2 class="section-title"><span class="icon">☀️</span>오늘의 루틴 업무</h2><div class="routine-tasks-container">${routineHtml}</div>`;
}

function renderTeacherSettings(items, sheetUrl) {
    const container = document.getElementById('teacher-settings-section');
    const newPostButtonHtml = `
        <div class="card form-creator" style="margin-bottom: 20px;">
            <div class="card-title">✨ 새 게시물/업무 등록</div>
            <button class="action-btn" style="background-color: var(--primary-color); width: 100%; margin-top: 10px;" onclick="openPostModal()">등록</button>
        </div>`;

    const adminToolsHtml = `<div class="teacher-dashboard-grid" style="grid-template-columns: 1fr 1fr;"><a href="${sheetUrl}" target="_blank" class="card"><div class="card-title">📊 데이터 시트 수정</div><p class="card-description">알림, 자료실 등 모든 데이터를 직접 수정합니다.</p></a></div>`;
    
    if (!items || items.length === 0) { 
        container.innerHTML = `<h2 class="section-title"><span class="icon">⚙️</span>설정</h2>${newPostButtonHtml}${adminToolsHtml}<div class="empty-state">등록된 자료가 없습니다.</div>`;
        return;
    }

    const grouped = items.reduce((acc, item) => { const type = item.종류 || '자료실'; (acc[type] = acc[type] || []).push(item); return acc; }, {});
    const tabs = ['학교업무', '수업자료', '자료실'];
    const tabButtonsHtml = tabs.map((tab, index) => `<button class="tab-button ${index === 0 ? 'active' : ''}" data-tab="teacher-tab-${index}">${tab}</button>`).join('');
    const tabPanesHtml = tabs.map((tab, index) => {
        const tabItems = grouped[tabs[index]] || [];
        let content = '<div class="empty-state">등록된 자료가 없습니다.</div>';
        if (tabItems.length > 0) { content = tabItems.map(item => `<a href="${item.링크}" target="_blank" class="card" id="${item.id}"><div class="card-title">${item.업무명}</div><p class="card-description">${item.상세내용 || ' '}</p></a>`).join(''); }
        return `<div id="teacher-tab-${index}" class="tab-pane ${index === 0 ? 'active' : ''}"><div class="teacher-dashboard-grid">${content}</div></div>`;
    }).join('');
    container.innerHTML = `<h2 class="section-title"><span class="icon">⚙️</span>설정</h2>${newPostButtonHtml}${adminToolsHtml}<div class="tabs" id="teacher-resource-tabs">${tabButtonsHtml}</div><div class="tab-content">${tabPanesHtml}</div>`;
    initTabs('teacher-resource-tabs');
}

function setupEventListeners() {
    document.getElementById('leave-request-form')?.addEventListener('submit', function(e) { e.preventDefault(); submitLeaveRequest(); });
    document.getElementById('closeLeaveModal')?.addEventListener('click', () => document.getElementById('modal-overlay-leave').style.display = 'none');

    document.getElementById('post-form')?.addEventListener('submit', function(e) { e.preventDefault(); createUnifiedPost(e.target); });
    document.getElementById('closePostModal')?.addEventListener('click', () => document.getElementById('modal-overlay').style.display = 'none');
    
    document.querySelectorAll('input[name="postType"]').forEach(radio => {
        radio.addEventListener('change', togglePostFormFields);
    });

    document.getElementById('post-assignment-type')?.addEventListener('change', togglePostFormFields);

    document.querySelector('#teacher-settings-section .card.form-creator button.action-btn')?.addEventListener('click', openPostModal);
}

function openPostModal() {
    const modal = document.getElementById('modal-overlay');
    modal.style.display = 'flex';
    modal.querySelector('#modal-title').textContent = '새 게시물/업무 등록';
    
    const form = document.getElementById('post-form');
    form.reset(); 
    document.getElementById('post-teacher-email').value = currentUser.email; 
    
    document.getElementById('post-type-selection').style.display = 'block';
    document.getElementById('common-fields').style.display = 'none';
    document.getElementById('student-only-fields').style.display = 'none';
    document.getElementById('task-only-fields').style.display = 'none';
    document.getElementById('teacher-task-only-fields').style.display = 'none';

    document.querySelectorAll('input[name="postType"]').forEach(radio => {
        radio.checked = false;
    });
}

function togglePostFormFields() {
    const selectedType = document.querySelector('input[name="postType"]:checked').value;
    const studentFields = document.getElementById('student-only-fields');
    const taskFields = document.getElementById('task-only-fields');
    const teacherTaskFields = document.getElementById('teacher-task-only-fields');
    const postAssignmentType = document.getElementById('post-assignment-type');
    document.getElementById('common-fields').style.display = 'block';

    studentFields.style.display = 'none';
    taskFields.style.display = 'none';
    teacherTaskFields.style.display = 'none';

    document.querySelectorAll('#post-form input, #post-form textarea, #post-form select').forEach(el => {
        el.removeAttribute('required');
        el.disabled = false;
    });
    
    document.getElementById('post-title').setAttribute('required', 'required');
    document.getElementById('post-content').setAttribute('required', 'required');

    switch (selectedType) {
        case '학생 공지':
            studentFields.style.display = 'block';
            break;
        case '학생 할 일':
            studentFields.style.display = 'block';
            taskFields.style.display = 'block';
            
            if (postAssignmentType.value === '구글폼 과제') {
                 document.getElementById('post-link').removeAttribute('required');
                 document.getElementById('post-button-text').removeAttribute('required');
                 document.getElementById('post-recordable').checked = true;
                 document.getElementById('post-recordable').disabled = true;
            } else {
                 document.getElementById('post-recordable').disabled = false;
            }
            break;
        case '교사 루틴 업무':
            teacherTaskFields.style.display = 'block';
            document.getElementById('post-repeat-condition').setAttribute('required', 'required');
            document.getElementById('post-teacher-email').setAttribute('required', 'required');
            break;
        case '교사 개인 할 일':
            teacherTaskFields.style.display = 'block';
            document.getElementById('post-teacher-email').setAttribute('required', 'required');
            break;
        case '학급 일정':
            studentFields.style.display = 'block';
            document.getElementById('post-start-date').setAttribute('required', 'required');
            break;
    }
}

async function createUnifiedPost(form) {
    const formData = new FormData(form);
    const type = formData.get('postType');
    const submitButton = document.getElementById('submitPost');
    submitButton.disabled = true;
    submitButton.textContent = '등록 중...';

    const params = new URLSearchParams({
        action: 'createUnifiedPost',
        type: type,
        title: formData.get('title'),
        content: formData.get('content'),
        icon: formData.get('icon'),
        imageUrl: formData.get('imageUrl'),
        link: formData.get('link'),
        buttonText: formData.get('buttonText'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        targetStudents: formData.get('targetStudents'),
        recordable: formData.get('recordable'),
        assignmentType: formData.get('assignmentType'),
        teacherEmail: formData.get('teacherEmail'),
        dueDate: formData.get('dueDate'),
        repeatCondition: formData.get('repeatCondition')
    });

    try {
        const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
        const result = await response.json();
        alert(result.message);
        if (result.status === 'success') {
            document.getElementById('modal-overlay').style.display = 'none';
            form.reset();
            loadData();
        }
    } catch (error) {
        alert('게시물 등록 중 오류 발생: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '등록';
    }
}

function handleLogout() {
    localStorage.removeItem('userInfo');
    currentUser = null;
    google.accounts.id.disableAutoSelect();
    location.reload();
}

function updateDateDisplay() {
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

async function completeItem(itemId, isTeacherAction = false, rowNum, sheetName) {
    const itemElement = document.getElementById(itemId) || document.getElementById(`status-${itemId}`);
    if (!itemElement) return;
    if (isTeacherAction) {
        const colName = (sheetName === '[데이터_알림]') ? '게시여부' : '상태';
        const value = (sheetName === '[데이터_알림]') ? 'N' : '완료';
        const params = new URLSearchParams({ action: 'updateTaskStatus', sheetName, rowNum, colName, value });
        try {
            const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
            const result = await res.json();
            if (result.status !== 'success') throw new Error(result.message);
        } catch (err) { alert(`처리 중 오류: ${err.message}`); return; }
    } else {
        completedItems[itemId] = true;
        saveCompletedItems();
    }
    itemElement.style.transition = 'opacity 0.5s, transform 0.5s, max-height 0.5s, margin 0.5s, padding 0.5s';
    itemElement.style.opacity = '0';
    itemElement.style.transform = 'scale(0.95)';
    setTimeout(() => itemElement.remove(), 500);
}

async function completePersonalTask(rowNum) {
    const sheetName = '[교사_개인_할일]';
    const colName = '완료여부';
    const value = 'TRUE';
    const params = new URLSearchParams({ action: 'updateTaskStatus', sheetName, rowNum, colName, value });
    try {
        const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message);
        const itemElement = document.getElementById(`personal-task-${rowNum}`);
        if (itemElement) {
            itemElement.style.transition = 'opacity 0.5s, transform 0.5s, max-height 0.5s, margin 0.5s, padding 0.5s';
            itemElement.style.opacity = '0';
            itemElement.style.transform = 'scale(0.95)';
            setTimeout(() => itemElement.remove(), 500);
        }
    } catch (err) { alert(`개인 할 일 완료 처리 중 오류: ${err.message}`); return; }
}

function toggleRoutineComplete(itemId) {
    const itemElement = document.getElementById(itemId);
    const checkbox = itemElement.querySelector('input[type="checkbox"]');
    if (checkbox.checked) { completedItems[itemId] = true; } 
    else { delete completedItems[itemId]; }
    saveCompletedItems();
    itemElement.classList.toggle('completed', checkbox.checked);
}

async function checkUnsubmitted(event, taskId, taskTitle, studentIdColumn) {
    event.stopPropagation();
    const button = event.target; button.disabled = true;
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getUnsubmittedStudents&taskId=${taskId}&studentIdColumn=${studentIdColumn}`);
        const result = await res.json();
        if (result.status !== 'success') throw new Error(result.message);
        let message = result.students.length === 0 ? `[${taskTitle}]\n\n모든 학생이 제출을 완료했습니다!` : `[${taskTitle}] 미제출 학생:\n\n` + result.students.map(s => `${s.name} (${s.id})`).join('\n');
        alert(message);
    } catch (error) { alert('미제출자 확인 중 오류: ' + error.message);
    } finally { button.disabled = false; }
}

async function updateLeaveStatus(rowNum, status, commentInputId) {
    const comment = document.getElementById(commentInputId)?.value || '';
    const params = new URLSearchParams({ action: 'updateLeaveStatus', rowNum, status, comment });
    try {
        const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
        const result = await res.json();
        if (result.status === 'success') { alert(`${status} 처리되었습니다.`); loadData(); } 
        else { throw new Error(result.message); }
    } catch (error) { alert('처리 중 오류: ' + error.message); }
}

function renderItems(containerId, items, sectionTitle) {
    const container = document.getElementById(containerId);
    if (!items || items.length === 0) { container.innerHTML = ''; return; }
    let itemsHtml = items.map(item => {
        let completeButtonIcon = completedItems[item.id] ? '✔' : '○';
        let completeButtonTitle = completedItems[item.id] ? '완료됨' : '확인/완료';
        let contentHtml = `<div class="notice-content">${item.내용.replace(/\n/g, '<br>')}</div>`;
        if (item.이미지URL) contentHtml += `<img src="${item.이미지URL}" alt="이미지" class="notice-image">`;
        if (item.링크) {
            let finalLink = item.링크;
            if (finalLink.includes('__STUDENT_ID__') && currentUser?.studentId) {
                finalLink = finalLink.replace('__STUDENT_ID__', currentUser.studentId).replace('__STUDENT_NAME__', encodeURIComponent(currentUser.name));
            }
            contentHtml += `<a href="${finalLink}" class="notice-link" target="_blank">${item.버튼이름 || '자세히 보기'}</a>`;
        }
        return `<div class="notice-item" id="${item.id}">
                    <button class="complete-btn" title="${completeButtonTitle}" onclick="completeItem('${item.id}')">${completeButtonIcon}</button>
                    <div class="card-title">${item.아이콘 || ''} ${item.제목}</div>
                    ${contentHtml}
                </div>`;
    }).join('');
    container.innerHTML = `<h2 class="section-title">${sectionTitle}</h2>${itemsHtml}`;
}

function renderUnsubmitted(tasks) {
    const container = document.getElementById('unsubmitted-container');
    if (!tasks || tasks.length === 0) { container.innerHTML = ''; return; }
    const listHtml = tasks.map(t => `<li>${t.아이콘||"📌"} ${t.제목||t.내용}</li>`).join('');
    container.innerHTML = `<div class="unsubmitted-section"><div style="font-weight: bold; color: #856404; margin-bottom: 10px;">🔔 아직 완료하지 않은 할 일이 있어요!</div><ul style="list-style: none; padding: 0;">${listHtml}</ul></div>`;
}

function renderLeaveRequests(requests) {
    const container = document.getElementById('leave-section');
    let requestButtons = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h2 class="section-title" style="margin: 0; border: none;">✈️ 외출/조퇴 신청</h2>
            <div style="display: flex; gap: 10px;">
                <button class="action-btn student-leave-btn" onclick="openLeaveModal('외출')">외출</button>
                <button class="action-btn student-early-leave-btn" onclick="openLeaveModal('조퇴')">조퇴</button>
            </div>
        </div>`;
    let historyHtml = '<div class="empty-state">신청 내역이 없습니다.</div>';
    if (requests && requests.length > 0) {
        historyHtml = requests.map(req => {
            const statusMap = { '신청': '#ffc107', '승인': '#28a745', '반려': '#dc3545' };
            const commentHtml = req.교사코멘트 ? `<div style="font-size: 0.9em; color: #6c757d; margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 8px;"><strong>교사 의견:</strong> ${req.교사코멘트}</div>` : '';
            const todayStr = new Date().toISOString().split('T')[0];
            const requestDate = new Date(req.희망일자).toISOString().split('T')[0];
            const certButton = (req.상태 === '승인' && requestDate === todayStr) ? `<a href="${SCRIPT_URL}?action=getCertificate&rowNum=${req.신청행번호}" target="_blank" class="action-btn student-cert-btn">확인증</a>` : '';
            return `<div class="notice-item"><div style="display: flex; justify-content: space-between; align-items: center;"><div><strong>${req.신청종류}</strong> (${new Date(req.희망일자).toLocaleDateString()})<br><small>사유: ${req.사유}</small></div><div style="display: flex; align-items: center; gap: 10px;"><span style="padding: 5px 10px; border-radius: 5px; color: white; background-color:${statusMap[req.상태] || '#6c757d'}; font-size: 0.9em;">${req.상태}</span>${certButton}</div></div>${commentHtml}</div>`;
        }).join('');
    }
    container.innerHTML = `${requestButtons}<h3>나의 신청 내역</h3>${historyHtml}`;
}

function renderResources(resources) {
    const container = document.getElementById('resources');
    if (!resources || resources.length === 0) { container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">등록된 자료가 없습니다.</div>'; return; }
    container.innerHTML = resources.map(res => `<a href="${res.링크}" target="_blank" class="card"><div class="card-title">${res.아이콘 || '🔗'} ${res.자료명}</div><p class="card-description">${res.설명 || ' '}</p></a>`).join('');
}

function openLeaveModal(type) {
    const modal = document.getElementById('modal-overlay-leave');
    if(modal) {
        modal.style.display = 'flex';
        modal.querySelector('#modal-title-leave').textContent = `${type} 신청`;
        modal.querySelector('#leave-type').value = type;
        modal.querySelector('#leave-date').value = new Date().toISOString().split('T')[0];
        modal.querySelector('#leave-reason').value = '';
    }
}

async function submitLeaveRequest() {
    if (!currentUser || !currentUser.studentId) { return alert("로그인 후 신청할 수 있습니다."); }
    const form = document.getElementById('leave-request-form');
    const formData = new FormData(form);
    const params = new URLSearchParams({ action: 'submitLeaveRequest', studentId: currentUser.studentId, name: currentUser.name, email: currentUser.email, type: formData.get('type'), reason: formData.get('reason'), date: formData.get('date') });
    document.getElementById('submitLeave').disabled = true;
    try {
        const response = await fetch(`${SCRIPT_URL}?${params.toString()}`);
        const result = await response.json();
        alert(result.message);
        if (result.status === 'success') {
            document.getElementById('modal-overlay-leave').style.display = 'none';
            form.reset();
            loadData();
        }
    } catch (error) { alert('신청 중 오류: ' + error.message);
    } finally { document.getElementById('submitLeave').disabled = false; }
}
</script>

</body>
</html>
