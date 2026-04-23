const GAS_URL = import.meta.env.VITE_GAS_API_URL;

// Local Mock Database for immediate testing/preview when no GAS script URL is provided.
const getDb = () => {
  const dbStr = localStorage.getItem("mock_classroom_db");
  if (dbStr) return JSON.parse(dbStr);
  const initial = {
    users: [
      { id: "1", username: "admin", password: "1123456", role: "admin" },
      { id: "2", username: "user", password: "123456", role: "user" }
    ],
    classrooms: [
      { id: "1", name: "A101" },
      { id: "2", name: "A102" },
      { id: "3", name: "B201" }
    ],
    bookings: [] as any[],
    locks: [] as any[]
  };
  localStorage.setItem("mock_classroom_db", JSON.stringify(initial));
  return initial;
};

const saveDb = (db: any) => localStorage.setItem("mock_classroom_db", JSON.stringify(db));

async function handleMockAction(action: string, payload: any) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 300));
  const db = getDb();

  switch (action) {
    case "login": {
      const u = db.users.find((u: any) => u.username === payload.username && u.password === payload.password);
      if (u) return { success: true, token: u.id, role: u.role, username: u.username };
      return { success: false, error: "帳號或密碼錯誤" };
    }
    case "getUsers": return { success: true, users: db.users };
    case "addUser": {
      const newUser = { id: Date.now().toString(), ...payload };
      db.users.push(newUser);
      saveDb(db);
      return { success: true, user: newUser };
    }
    case "deleteUser": {
      db.users = db.users.filter((u: any) => u.id !== payload.id);
      saveDb(db);
      return { success: true };
    }
    case "getClassrooms": return { success: true, classrooms: db.classrooms };
    case "addClassroom": {
      const newCls = { id: Date.now().toString(), ...payload };
      db.classrooms.push(newCls);
      saveDb(db);
      return { success: true, classroom: newCls };
    }
    case "deleteClassroom": {
      db.classrooms = db.classrooms.filter((c: any) => c.id !== payload.id);
      saveDb(db);
      return { success: true };
    }
    case "getUserBookings": {
      let bookings = db.bookings;
      if (payload.role !== 'admin') {
        bookings = bookings.filter((b: any) => b.bookerName === payload.username);
      }
      return { success: true, bookings };
    }
    case "getSchedule": {
      let bookings = db.bookings;
      let locks = db.locks;
      if (payload.classroomId) {
        bookings = bookings.filter((b: any) => b.classroomId === payload.classroomId);
        locks = locks.filter((l: any) => l.classroomId === payload.classroomId);
      }
      if (payload.startDate && payload.endDate) {
        bookings = bookings.filter((b: any) => b.date >= payload.startDate && b.date <= payload.endDate);
        locks = locks.filter((l: any) => l.date >= payload.startDate && l.date <= payload.endDate);
      }
      return { success: true, bookings, locks };
    }
    case "addBooking": {
      const { classroomId, date, period } = payload;
      const isConflict = db.bookings.some((b: any) => b.classroomId === classroomId && b.date === date && b.period === period);
      const isLocked = db.locks.some((l: any) => l.classroomId === classroomId && l.date === date && l.period === period);
      if (isConflict || isLocked) return { success: false, error: "此時段已被使用或不可預約" };
      
      const newBooking = { id: Date.now().toString() + Math.random().toString(36).substring(7), ...payload };
      db.bookings.push(newBooking);
      saveDb(db);
      return { success: true, booking: newBooking };
    }
    case "updateBooking": {
      const { id, batchId, isBatch, userName, courseContent } = payload;
      db.bookings.forEach((b: any) => {
        if (isBatch && batchId && b.batchId === batchId) {
          b.userName = userName;
          b.courseContent = courseContent;
        } else if (!isBatch && b.id === id) {
          b.userName = userName;
          b.courseContent = courseContent;
        }
      });
      saveDb(db);
      return { success: true };
    }
    case "deleteBooking": {
      const { id, batchId, isBatch } = payload;
      if (isBatch && batchId) {
        db.bookings = db.bookings.filter((b: any) => b.batchId !== batchId);
      } else {
        db.bookings = db.bookings.filter((b: any) => b.id !== id);
      }
      saveDb(db);
      return { success: true };
    }
    case "addLock": {
      const newLock = { id: Date.now().toString(), ...payload };
      db.locks.push(newLock);
      saveDb(db);
      return { success: true, lock: newLock };
    }
    case "deleteLock": {
      db.locks = db.locks.filter((l: any) => l.id !== payload.id);
      saveDb(db);
      return { success: true };
    }
    case "deleteUserBookings": {
      db.bookings = db.bookings.filter((b: any) => b.bookerName !== payload.targetUser);
      saveDb(db);
      return { success: true };
    }
    case "deleteAllBookings": {
      db.bookings = [];
      saveDb(db);
      return { success: true };
    }
    default:
      return { success: false, error: "Unknown action" };
  }
}

export async function apiCall(action: string, payload: any = {}): Promise<any> {
  if (!GAS_URL) {
    return handleMockAction(action, payload);
  }

  try {
    // Standard fetch with JSON body triggers a CORS pre-flight (OPTIONS) request, which GAS famously struggles with.
    // To completely bypass CORS, we must send a "Simple Request" by using Content-Type: text/plain
    const requestData = JSON.stringify({ action, ...payload });

    const response = await fetch(GAS_URL, {
      method: 'POST',
      body: requestData,
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
    });
    
    const rawText = await response.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch(e) {
      console.error("Failed to parse JSON. Raw API response:", rawText);
      throw new Error(`回傳格式異常，可能發生重新導向錯誤：\n${rawText.substring(0,100)}...`);
    }

    return result;
  } catch (err: any) {
    console.error("API Error", err);
    throw new Error(err.message || "網路請求被瀏覽器擋下 (CORS/Preflight 失敗)，請確保網址正確且沒有自訂標頭。");
  }
}


