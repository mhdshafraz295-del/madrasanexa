// MadrasaNexa Teacher Portal — Illustrative Prototype Mock Data
// STRICT NOTICE: This is clearly labelled illustrative prototype data for UI evaluation only.
// Never represent this as real institutional or personal data.

export interface TeacherProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  arabicName: string;
  avatarUrl: string;
  photoUrl?: string;
  profilePhoto?: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  whatsapp: string;
  status: 'Active' | 'On Leave' | 'Visiting';
  dateOfJoining: string;
  bloodGroup: string;
  nicPassport: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  residentialAddress: string;
  district: string;
  postalCode: string;
  country: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  academicQualifications: Array<{
    id: string;
    degree: string;
    institution: string;
    year: string;
    gradeHonor: string;
  }>;
  professionalQualifications: Array<{
    id: string;
    title: string;
    issuingBody: string;
    year: string;
    credentialId?: string;
  }>;
  teachingExperience: Array<{
    id: string;
    institution: string;
    role: string;
    period: string;
    responsibilities: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    fileName: string;
    fileSize: string;
    uploadedDate: string;
    status: 'Verified' | 'Pending Review' | 'Optional';
    category: 'Degree' | 'Ijazah' | 'Identity' | 'Clearance';
  }>;
  profileCompletionPercentage: number;
}

export interface PermanentClassroom {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  qrPayload: string;
  nfcTagId: string;
  description: string;
}

export interface TimetableSlot {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  period: number;
  timeSlot: string;
  className: string;
  subject: string;
  room: string;
  roomId: string;
  studentsCount: number;
  enrolledCount?: number;
  academicSection?: string;
  status: 'Completed' | 'In Progress' | 'Upcoming';
  notes?: string;
}

export interface AssignedStudent {
  id: string;
  rollNo: string;
  barcodeId: string;
  name: string;
  guardianPhone: string;
  attendanceRate: number;
  lastScore: string;
  status: 'Present' | 'Late' | 'Excused' | 'Absent';
  scannedAt?: string;
  manualNote?: string;
}

export interface AssignedClass {
  id: string;
  name: string;
  code: string;
  stream: string;
  academicSection?: string;
  gradeLevel: string;
  totalStudents: number;
  enrolledCount?: number;
  maleStudents?: number;
  femaleStudents?: number;
  subjectTaught: string;
  classMonitor?: string;
  room?: string;
  roomId?: string;
  syllabusProgress?: number; // 0 - 100
  attendanceRate?: number | null; // 0 - 100 or null
  meetingSchedule?: string;
  students: AssignedStudent[];
}

export interface TeacherNotification {
  id: string;
  title: string;
  message: string;
  category: 'Academic' | 'Administrative' | 'Exam' | 'Emergency';
  priority: 'High' | 'Normal' | 'Low';
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  sender: string;
}

export interface TeacherAttendanceRecord {
  id: string;
  date: string;
  time: string;
  period: number;
  periodTime: string;
  classId: string;
  className: string;
  subject: string;
  roomId: string;
  roomName: string;
  classroomQrScanned: string;
  status: 'Verified' | 'Late' | 'Manual Override' | 'Missed';
  method: 'Classroom QR' | 'Manual Fallback';
  graceWindowMinutes: number;
  verifiedAt: string;
  notes?: string;
}

export interface HistoricalAttendanceSession {
  id: string;
  sessionCode: string;
  date: string;
  period: number;
  timeSlot: string;
  classId: string;
  className: string;
  subject: string;
  roomId: string;
  roomName: string;
  teacherId: string;
  teacherName: string;
  teacherVerifiedAt: string;
  teacherStatus: 'Verified On-Time' | 'Late Entry' | 'Manual Authorized';
  totalEnrolled: number;
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  attendanceRate: number;
  isSealed: boolean;
  sealedAt: string;
  roster: Array<{
    studentId: string;
    rollNo: string;
    name: string;
    status: 'Present' | 'Late' | 'Excused' | 'Absent';
    scannedTime?: string;
    method: 'Barcode Scan' | 'Teacher Manual';
    remarks?: string;
  }>;
}

export const MOCK_PERMANENT_CLASSROOMS: PermanentClassroom[] = [
  {
    id: 'room-b201',
    code: 'ROOM-B201',
    name: 'Hall B-201 (Tahfeez Studio)',
    building: 'Imam Shatibi Academic Complex',
    floor: '2nd Floor, Wing B',
    capacity: 35,
    qrPayload: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:B-201|PERMANENT_VENUE_ID:VNU-77401',
    nfcTagId: 'NFC-B201-9921',
    description: 'Acoustically treated recitation auditorium with digital tajweed microphones.',
  },
  {
    id: 'room-104',
    code: 'ROOM-104',
    name: 'Lecture Hall 104 (Shariah Exegesis)',
    building: 'Ibn Abbas Classical Wing',
    floor: '1st Floor, East corridor',
    capacity: 45,
    qrPayload: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:104|PERMANENT_VENUE_ID:VNU-77404',
    nfcTagId: 'NFC-104-8842',
    description: 'Tiered lecture theater with interactive projection and smart podium.',
  },
  {
    id: 'room-av2',
    code: 'ROOM-AV2',
    name: 'AV Studio 2 (Phonetics Lab)',
    building: 'Learning Resources Center',
    floor: 'Ground Floor, Media Suite',
    capacity: 30,
    qrPayload: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:AV2|PERMANENT_VENUE_ID:VNU-77412',
    nfcTagId: 'NFC-AV2-1043',
    description: 'Multimedia audio-visual lab equipped for phonetic tajweed analysis.',
  },
  {
    id: 'room-aud',
    code: 'ROOM-AUD',
    name: 'Main Auditorium (Grand Hall)',
    building: 'Central Administration Block',
    floor: 'Ground Level',
    capacity: 120,
    qrPayload: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:AUD|PERMANENT_VENUE_ID:VNU-77490',
    nfcTagId: 'NFC-AUD-0012',
    description: 'General assembly hall for graduate seminars and public dissertations.',
  },
];

export const MOCK_TEACHER_PROFILE: TeacherProfile = {
  id: 'tch-2026-042',
  employeeCode: 'UST-2026-042',
  fullName: 'Ustadh Sheikh Abdullah Farooq Al-Azhari',
  arabicName: 'فضيلة الشيخ عبد الله فاروق الأزهري',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  designation: 'Senior Faculty in Quranic Sciences & Tajweed',
  department: 'Department of Tahfeez & Hadith Studies',
  email: 'abdullah.farooq@madrasanexa.lk',
  phone: '+94 77 245 8891',
  whatsapp: '+94 77 245 8891',
  status: 'Active',
  dateOfJoining: '15 January 2022',
  bloodGroup: 'O+',
  nicPassport: 'SAMPLE-NIC-198812304567',
  dateOfBirth: '14 May 1988',
  gender: 'Male',
  maritalStatus: 'Married',
  residentialAddress: 'No. 42, Mosque Road, Kalutara South',
  district: 'Kalutara',
  postalCode: '12000',
  country: 'Sri Lanka',
  emergencyContact: {
    name: 'Fathima Farooq',
    relationship: 'Spouse',
    phone: '+94 71 884 1239',
  },
  academicQualifications: [
    {
      id: 'aq-1',
      degree: 'Bachelor of Islamic Studies (Usul al-Din)',
      institution: 'Al-Azhar University, Cairo, Egypt',
      year: '2012',
      gradeHonor: 'First Class with Distinction (Mumtaz)',
    },
    {
      id: 'aq-2',
      degree: 'Master of Arts in Hadith & Sunnah Studies',
      institution: 'University of Colombo (Faculty of Arts)',
      year: '2016',
      gradeHonor: 'Distinction',
    },
  ],
  professionalQualifications: [
    {
      id: 'pq-1',
      title: 'Alimiyyah Sanad in Shariah & Arabic Literature',
      issuingBody: 'Jamiah Naleemiah Islamic Institute',
      year: '2010',
      credentialId: 'JN-SANAD-2010-884',
    },
    {
      id: 'pq-2',
      title: 'Sanad & Ijazah Muttasilah in Ten Minor Qira’at',
      issuingBody: 'Maktabah Sheikh Dr. Ayman Rushdi Suwayd (Jeddah)',
      year: '2014',
      credentialId: 'IJZ-QIR-1435-042',
    },
    {
      id: 'pq-3',
      title: 'National Diploma in Teaching Pedagogy & Classroom Management',
      issuingBody: 'National Institute of Education (NIE Sri Lanka)',
      year: '2018',
      credentialId: 'NIE-PED-2018-192',
    },
  ],
  teachingExperience: [
    {
      id: 'te-1',
      institution: 'Al-Jamiathul Qasimiyyah Arabic College',
      role: 'Senior Faculty & Department Coordinator',
      period: '2022 – Present (4 Years)',
      responsibilities: 'Overseeing Tahfeez curriculum, teaching advanced Tafseer and supervising quarterly Hifz recitation examinations.',
    },
    {
      id: 'te-2',
      institution: 'Darul Uloom Colombo Central',
      role: 'Lecturer in Arabic Grammar (Nahw & Sarf)',
      period: '2018 – 2021 (3 Years)',
      responsibilities: 'Delivered core linguistic modules and supervised student debate competitions in classical Arabic.',
    },
    {
      id: 'te-3',
      institution: 'Al-Hikmah International Islamic Academy',
      role: 'Tajweed Instructor & Student Counselor',
      period: '2013 – 2018 (5 Years)',
      responsibilities: 'Coordinated foundation Quran memorization program for young learners and parent-teacher consultative sessions.',
    },
  ],
  documents: [
    {
      id: 'doc-1',
      title: 'Alimiyyah Degree Certificate & Academic Transcript',
      fileName: 'Alimiyyah_Sanad_Jamiah_Naleemiah.pdf',
      fileSize: '2.8 MB',
      uploadedDate: '2026-01-10',
      status: 'Verified',
      category: 'Degree',
    },
    {
      id: 'doc-2',
      title: 'Authentic Ijazah in Ten Qira’at Sanad Copy',
      fileName: 'Ijazah_Ten_Qiraat_Sanad_Certified.pdf',
      fileSize: '4.1 MB',
      uploadedDate: '2026-01-12',
      status: 'Verified',
      category: 'Ijazah',
    },
    {
      id: 'doc-3',
      title: 'National Identity Card (Colored Front/Back Scan)',
      fileName: 'National_Identity_Card_198812304567.pdf',
      fileSize: '1.2 MB',
      uploadedDate: '2026-01-15',
      status: 'Verified',
      category: 'Identity',
    },
    {
      id: 'doc-4',
      title: 'Annual Police Character Clearance Certificate',
      fileName: 'Police_Clearance_Western_Province_2026.pdf',
      fileSize: '950 KB',
      uploadedDate: '2026-02-01',
      status: 'Pending Review',
      category: 'Clearance',
    },
  ],
  profileCompletionPercentage: 75,
};

export const MOCK_INSTITUTION_INFO = {
  name: 'Al-Jamiathul Qasimiyyah Arabic College',
  campus: 'Main Campus, Colombo 10',
  code: 'SAMPLE-AJQ-COL',
  registrationNumber: 'SAMPLE-REG-2024-8841 (Sample Data)',
  currentAcademicYear: '2026 / 2027',
  currentTerm: 'Second Semester',
  hijriDate: '27 Jumada al-Awwal 1448 AH',
  gregorianDate: 'Monday, 16 November 2026',
};

export const MOCK_TIMETABLE: TimetableSlot[] = [
  // Monday
  {
    id: 'tt-mon-1',
    day: 'Monday',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz & Muraja’ah (Juz 25-27)',
    room: 'Hall B-201',
    roomId: 'room-b201',
    studentsCount: 28,
    status: 'Completed',
    notes: 'Individual recitation review & tajweed recording',
  },
  {
    id: 'tt-mon-2',
    day: 'Monday',
    period: 2,
    timeSlot: '09:00 AM – 09:45 AM',
    className: 'Class 11-B (Alimiyyah Year 2)',
    subject: 'Tafseer Ibn Katheer (Surah Al-Kahf)',
    room: 'Lecture Hall 104',
    roomId: 'room-104',
    studentsCount: 32,
    status: 'In Progress',
    notes: 'Discussion on thematic coherence & linguistic nuances',
  },
  {
    id: 'tt-mon-3',
    day: 'Monday',
    period: 3,
    timeSlot: '10:15 AM – 11:00 AM',
    className: 'Class 8-C (Junior Tahfeez)',
    subject: 'Tajweed Rules (Makharij & Sifat)',
    room: 'AV Studio 2',
    roomId: 'room-av2',
    studentsCount: 24,
    status: 'Upcoming',
    notes: 'Interactive audio phonetics session',
  },
  {
    id: 'tt-mon-4',
    day: 'Monday',
    period: 4,
    timeSlot: '11:30 AM – 12:15 PM',
    className: 'Class 12-A (Advanced Shariah)',
    subject: 'Uloom al-Quran (Asbab an-Nuzul)',
    room: 'Main Auditorium',
    roomId: 'room-aud',
    studentsCount: 30,
    status: 'Upcoming',
    notes: 'Analytical essay assignment review',
  },

  // Tuesday
  {
    id: 'tt-tue-1',
    day: 'Tuesday',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    className: 'Class 8-C (Junior Tahfeez)',
    subject: 'Tajweed Practical Recitation',
    room: 'AV Studio 2',
    roomId: 'room-av2',
    studentsCount: 24,
    status: 'Upcoming',
  },
  {
    id: 'tt-tue-2',
    day: 'Tuesday',
    period: 2,
    timeSlot: '09:00 AM – 09:45 AM',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz Revision & Speed Recitation',
    room: 'Hall B-201',
    roomId: 'room-b201',
    studentsCount: 28,
    status: 'Upcoming',
  },
  {
    id: 'tt-tue-3',
    day: 'Tuesday',
    period: 3,
    timeSlot: '10:15 AM – 11:00 AM',
    className: 'Class 11-B (Alimiyyah Year 2)',
    subject: 'Hadith Analysis (Riyad as-Salihin)',
    room: 'Lecture Hall 104',
    roomId: 'room-104',
    studentsCount: 32,
    status: 'Upcoming',
  },

  // Wednesday
  {
    id: 'tt-wed-1',
    day: 'Wednesday',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    className: 'Class 12-A (Advanced Shariah)',
    subject: 'Qira’at Studies & Transmission Chains',
    room: 'Main Auditorium',
    roomId: 'room-aud',
    studentsCount: 30,
    status: 'Upcoming',
  },
  {
    id: 'tt-wed-2',
    day: 'Wednesday',
    period: 2,
    timeSlot: '09:00 AM – 09:45 AM',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz Evaluation (Weekly Testing)',
    room: 'Hall B-201',
    roomId: 'room-b201',
    studentsCount: 28,
    status: 'Upcoming',
  },
  {
    id: 'tt-wed-4',
    day: 'Wednesday',
    period: 4,
    timeSlot: '11:30 AM – 12:15 PM',
    className: 'Class 8-C (Junior Tahfeez)',
    subject: 'Islamic Ethics & Adab al-Talib',
    room: 'AV Studio 2',
    roomId: 'room-av2',
    studentsCount: 24,
    status: 'Upcoming',
  },

  // Thursday
  {
    id: 'tt-thu-1',
    day: 'Thursday',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    className: 'Class 11-B (Alimiyyah Year 2)',
    subject: 'Tafseer & Linguistic Exegesis',
    room: 'Lecture Hall 104',
    roomId: 'room-104',
    studentsCount: 32,
    status: 'Upcoming',
  },
  {
    id: 'tt-thu-2',
    day: 'Thursday',
    period: 2,
    timeSlot: '09:00 AM – 09:45 AM',
    className: 'Class 12-A (Advanced Shariah)',
    subject: 'Usul at-Tafseer (Methodology)',
    room: 'Main Auditorium',
    roomId: 'room-aud',
    studentsCount: 30,
    status: 'Upcoming',
  },
  {
    id: 'tt-thu-3',
    day: 'Thursday',
    period: 3,
    timeSlot: '10:15 AM – 11:00 AM',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz Muraja’ah & Correction',
    room: 'Hall B-201',
    roomId: 'room-b201',
    studentsCount: 28,
    status: 'Upcoming',
  },

  // Friday
  {
    id: 'tt-fri-1',
    day: 'Friday',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Weekly Jumu’ah Kahf Memorization Check',
    room: 'Hall B-201',
    roomId: 'room-b201',
    studentsCount: 28,
    status: 'Upcoming',
  },
  {
    id: 'tt-fri-2',
    day: 'Friday',
    period: 2,
    timeSlot: '09:00 AM – 09:45 AM',
    className: 'Class 12-A (Advanced Shariah)',
    subject: 'Khutbah Preparation & Delivery Workshop',
    room: 'Main Auditorium',
    roomId: 'room-aud',
    studentsCount: 30,
    status: 'Upcoming',
  },
];

export const MOCK_ASSIGNED_CLASSES: AssignedClass[] = [
  {
    id: 'cls-10a',
    name: 'Class 10-A (Tahfeez Stream)',
    code: 'THF-10A',
    stream: 'Senior Tahfeez & Tajweed',
    gradeLevel: 'Grade 10',
    totalStudents: 10,
    maleStudents: 10,
    femaleStudents: 0,
    subjectTaught: 'Hifz & Muraja’ah (Juz 25 to 27)',
    classMonitor: 'Muhammad Bilal Riyaz',
    room: 'Hall B-201',
    roomId: 'room-b201',
    syllabusProgress: 72,
    attendanceRate: 96.4,
    meetingSchedule: 'Mon, Tue, Wed, Thu, Fri (08:00 AM)',
    students: [
      { id: 'st-01', rollNo: 'STU-10A-01', barcodeId: 'BC-STU-10A-01', name: 'Muhammad Bilal Riyaz', guardianPhone: '+94 77 112 3344', attendanceRate: 98.2, lastScore: '96/100', status: 'Present', scannedAt: '08:02 AM' },
      { id: 'st-02', rollNo: 'STU-10A-02', barcodeId: 'BC-STU-10A-02', name: 'Zaid Abdul Rahman', guardianPhone: '+94 77 223 4455', attendanceRate: 95.0, lastScore: '92/100', status: 'Present', scannedAt: '08:04 AM' },
      { id: 'st-03', rollNo: 'STU-10A-03', barcodeId: 'BC-STU-10A-03', name: 'Omar Farooq Naushad', guardianPhone: '+94 77 334 5566', attendanceRate: 92.5, lastScore: '88/100', status: 'Late', scannedAt: '08:18 AM' },
      { id: 'st-04', rollNo: 'STU-10A-04', barcodeId: 'BC-STU-10A-04', name: 'Ahmed Hamza Shiyam', guardianPhone: '+94 77 445 6677', attendanceRate: 97.0, lastScore: '94/100', status: 'Present', scannedAt: '08:01 AM' },
      { id: 'st-05', rollNo: 'STU-10A-05', barcodeId: 'BC-STU-10A-05', name: 'Ibrahim Khalid Fazal', guardianPhone: '+94 77 556 7788', attendanceRate: 91.0, lastScore: '85/100', status: 'Excused', manualNote: 'Medical appointment certified' },
      { id: 'st-06', rollNo: 'STU-10A-06', barcodeId: 'BC-STU-10A-06', name: 'Abdullah Tariq Mansoor', guardianPhone: '+94 77 667 1122', attendanceRate: 94.2, lastScore: '90/100', status: 'Present', scannedAt: '08:05 AM' },
      { id: 'st-07', rollNo: 'STU-10A-07', barcodeId: 'BC-STU-10A-07', name: 'Hasan Basheer Rizwan', guardianPhone: '+94 77 778 2233', attendanceRate: 96.5, lastScore: '95/100', status: 'Present', scannedAt: '08:03 AM' },
      { id: 'st-08', rollNo: 'STU-10A-08', barcodeId: 'BC-STU-10A-08', name: 'Yusuf Imtiaz Al-Hadi', guardianPhone: '+94 77 889 3344', attendanceRate: 89.0, lastScore: '82/100', status: 'Absent' },
      { id: 'st-09', rollNo: 'STU-10A-09', barcodeId: 'BC-STU-10A-09', name: 'Hamid Luqman Shibly', guardianPhone: '+94 77 990 4455', attendanceRate: 98.0, lastScore: '97/100', status: 'Present', scannedAt: '08:01 AM' },
      { id: 'st-10', rollNo: 'STU-10A-10', barcodeId: 'BC-STU-10A-10', name: 'Musthafa Kamal Nizam', guardianPhone: '+94 77 001 5566', attendanceRate: 93.4, lastScore: '89/100', status: 'Present', scannedAt: '08:06 AM' },
    ],
  },
  {
    id: 'cls-11b',
    name: 'Class 11-B (Alimiyyah Year 2)',
    code: 'ALM-11B',
    stream: 'Alimiyyah Islamic Shariah',
    gradeLevel: 'Grade 11',
    totalStudents: 8,
    maleStudents: 8,
    femaleStudents: 0,
    subjectTaught: 'Tafseer Ibn Katheer & Hadith Analysis',
    classMonitor: 'Tariq Jameel Al-Hadi',
    room: 'Lecture Hall 104',
    roomId: 'room-104',
    syllabusProgress: 65,
    attendanceRate: 93.8,
    meetingSchedule: 'Mon, Tue, Thu (09:00 AM)',
    students: [
      { id: 'st-11', rollNo: 'STU-11B-01', barcodeId: 'BC-STU-11B-01', name: 'Tariq Jameel Al-Hadi', guardianPhone: '+94 77 667 8899', attendanceRate: 96.5, lastScore: '91/100', status: 'Present', scannedAt: '09:02 AM' },
      { id: 'st-12', rollNo: 'STU-11B-02', barcodeId: 'BC-STU-11B-02', name: 'Salmanul Farisi Ashraff', guardianPhone: '+94 77 778 9900', attendanceRate: 94.0, lastScore: '89/100', status: 'Present', scannedAt: '09:03 AM' },
      { id: 'st-13', rollNo: 'STU-11B-03', barcodeId: 'BC-STU-11B-03', name: 'Hussain Ali Rizwan', guardianPhone: '+94 77 889 0011', attendanceRate: 88.0, lastScore: '80/100', status: 'Absent' },
      { id: 'st-14', rollNo: 'STU-11B-04', barcodeId: 'BC-STU-11B-04', name: 'Ammar Yasir Al-Bukhari', guardianPhone: '+94 77 990 1122', attendanceRate: 95.5, lastScore: '93/100', status: 'Present', scannedAt: '09:01 AM' },
      { id: 'st-15', rollNo: 'STU-11B-05', barcodeId: 'BC-STU-11B-05', name: 'Nawfal Zubair Qasim', guardianPhone: '+94 77 001 2233', attendanceRate: 92.0, lastScore: '87/100', status: 'Late', scannedAt: '09:14 AM' },
      { id: 'st-16', rollNo: 'STU-11B-06', barcodeId: 'BC-STU-11B-06', name: 'Uthman Affan Majeed', guardianPhone: '+94 77 112 3344', attendanceRate: 97.0, lastScore: '95/100', status: 'Present', scannedAt: '09:04 AM' },
      { id: 'st-17', rollNo: 'STU-11B-07', barcodeId: 'BC-STU-11B-07', name: 'Talha Ubaidullah Shafi', guardianPhone: '+94 77 223 4455', attendanceRate: 90.0, lastScore: '86/100', status: 'Excused', manualNote: 'Approved family emergency' },
      { id: 'st-18', rollNo: 'STU-11B-08', barcodeId: 'BC-STU-11B-08', name: 'Saad Waqqas Al-Basri', guardianPhone: '+94 77 334 5566', attendanceRate: 96.0, lastScore: '92/100', status: 'Present', scannedAt: '09:05 AM' },
    ],
  },
  {
    id: 'cls-8c',
    name: 'Class 8-C (Junior Tahfeez)',
    code: 'JTF-08C',
    stream: 'Junior Tahfeez Foundation',
    gradeLevel: 'Grade 8',
    totalStudents: 6,
    maleStudents: 6,
    femaleStudents: 0,
    subjectTaught: 'Tajweed Rules (Makharij & Sifat)',
    classMonitor: 'Yusuf Rayyan Marikar',
    room: 'AV Studio 2',
    roomId: 'room-av2',
    syllabusProgress: 80,
    attendanceRate: 97.2,
    meetingSchedule: 'Mon, Tue, Wed (10:15 AM)',
    students: [
      { id: 'st-21', rollNo: 'STU-08C-01', barcodeId: 'BC-STU-08C-01', name: 'Yusuf Rayyan Marikar', guardianPhone: '+94 77 990 1122', attendanceRate: 98.0, lastScore: '95/100', status: 'Present', scannedAt: '10:17 AM' },
      { id: 'st-22', rollNo: 'STU-08C-02', barcodeId: 'BC-STU-08C-02', name: 'Ammar Yasir Shibly', guardianPhone: '+94 77 001 2233', attendanceRate: 96.0, lastScore: '93/100', status: 'Present', scannedAt: '10:16 AM' },
      { id: 'st-23', rollNo: 'STU-08C-03', barcodeId: 'BC-STU-08C-03', name: 'Zubair Bilal Rameez', guardianPhone: '+94 77 112 3344', attendanceRate: 94.0, lastScore: '91/100', status: 'Present', scannedAt: '10:19 AM' },
      { id: 'st-24', rollNo: 'STU-08C-04', barcodeId: 'BC-STU-08C-04', name: 'Idrees Haroon Naeem', guardianPhone: '+94 77 223 4455', attendanceRate: 99.0, lastScore: '98/100', status: 'Present', scannedAt: '10:15 AM' },
      { id: 'st-25', rollNo: 'STU-08C-05', barcodeId: 'BC-STU-08C-05', name: 'Mikail Danish Faris', guardianPhone: '+94 77 334 5566', attendanceRate: 92.5, lastScore: '89/100', status: 'Late', scannedAt: '10:28 AM' },
      { id: 'st-26', rollNo: 'STU-08C-06', barcodeId: 'BC-STU-08C-06', name: 'Kabeer Hakeem Faheem', guardianPhone: '+94 77 445 6677', attendanceRate: 91.0, lastScore: '88/100', status: 'Present', scannedAt: '10:18 AM' },
    ],
  },
  {
    id: 'cls-12a',
    name: 'Class 12-A (Advanced Shariah)',
    code: 'SHR-12A',
    stream: 'Senior Shariah Graduate Prep',
    gradeLevel: 'Grade 12',
    totalStudents: 6,
    maleStudents: 6,
    femaleStudents: 0,
    subjectTaught: 'Uloom al-Quran & Asbab an-Nuzul',
    classMonitor: 'Anas Zubair Ashraff',
    room: 'Main Auditorium',
    roomId: 'room-aud',
    syllabusProgress: 58,
    attendanceRate: 92.1,
    meetingSchedule: 'Mon, Wed, Thu, Fri (11:30 AM)',
    students: [
      { id: 'st-31', rollNo: 'STU-12A-01', barcodeId: 'BC-STU-12A-01', name: 'Anas Zubair Ashraff', guardianPhone: '+94 77 123 7766', attendanceRate: 95.0, lastScore: '90/100', status: 'Present', scannedAt: '11:32 AM' },
      { id: 'st-32', rollNo: 'STU-12A-02', barcodeId: 'BC-STU-12A-02', name: 'Musab Umair Hilmy', guardianPhone: '+94 77 234 8877', attendanceRate: 90.0, lastScore: '84/100', status: 'Present', scannedAt: '11:34 AM' },
      { id: 'st-33', rollNo: 'STU-12A-03', barcodeId: 'BC-STU-12A-03', name: 'Hudhaifa Qatadah Junaid', guardianPhone: '+94 77 345 9988', attendanceRate: 93.0, lastScore: '88/100', status: 'Present', scannedAt: '11:31 AM' },
      { id: 'st-34', rollNo: 'STU-12A-04', barcodeId: 'BC-STU-12A-04', name: 'Suhayb Roomi Ilyas', guardianPhone: '+94 77 456 0099', attendanceRate: 96.0, lastScore: '92/100', status: 'Present', scannedAt: '11:33 AM' },
      { id: 'st-35', rollNo: 'STU-12A-05', barcodeId: 'BC-STU-12A-05', name: 'Abu Bakr Siddiq Faleel', guardianPhone: '+94 77 567 1100', attendanceRate: 88.5, lastScore: '81/100', status: 'Absent' },
      { id: 'st-36', rollNo: 'STU-12A-06', barcodeId: 'BC-STU-12A-06', name: 'Miqdad Amr Luqman', guardianPhone: '+94 77 678 2211', attendanceRate: 91.0, lastScore: '86/100', status: 'Present', scannedAt: '11:35 AM' },
    ],
  },
];

export const MOCK_TEACHER_ATTENDANCE_LOGS: TeacherAttendanceRecord[] = [
  {
    id: 'tlog-01',
    date: '2026-11-16',
    time: '07:56 AM',
    period: 1,
    periodTime: '08:00 AM – 08:45 AM',
    classId: 'cls-10a',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz & Muraja’ah (Juz 25-27)',
    roomId: 'room-b201',
    roomName: 'Hall B-201',
    classroomQrScanned: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:B-201|PERMANENT_VENUE_ID:VNU-77401',
    status: 'Verified',
    method: 'Classroom QR',
    graceWindowMinutes: 15,
    verifiedAt: '2026-11-16T07:56:42Z',
    notes: 'Scanned permanent QR plaque affixed at classroom entrance',
  },
  {
    id: 'tlog-02',
    date: '2026-11-14',
    time: '08:02 AM',
    period: 1,
    periodTime: '08:00 AM – 08:45 AM',
    classId: 'cls-11b',
    className: 'Class 11-B (Alimiyyah Year 2)',
    subject: 'Tafseer & Linguistic Exegesis',
    roomId: 'room-104',
    roomName: 'Lecture Hall 104',
    classroomQrScanned: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:104|PERMANENT_VENUE_ID:VNU-77404',
    status: 'Verified',
    method: 'Classroom QR',
    graceWindowMinutes: 15,
    verifiedAt: '2026-11-14T08:02:11Z',
  },
  {
    id: 'tlog-03',
    date: '2026-11-13',
    time: '08:18 AM',
    period: 1,
    periodTime: '08:00 AM – 08:45 AM',
    classId: 'cls-10a',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Weekly Jumu’ah Kahf Memorization Check',
    roomId: 'room-b201',
    roomName: 'Hall B-201',
    classroomQrScanned: 'MADRASANEXA|TENANT:AJQ-COL|ROOM:B-201|PERMANENT_VENUE_ID:VNU-77401',
    status: 'Late',
    method: 'Classroom QR',
    graceWindowMinutes: 15,
    verifiedAt: '2026-11-13T08:18:05Z',
    notes: 'Campus traffic delay reported to Academic Registrar',
  },
  {
    id: 'tlog-04',
    date: '2026-11-12',
    time: '09:05 AM',
    period: 2,
    periodTime: '09:00 AM – 09:45 AM',
    classId: 'cls-10a',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz Evaluation (Weekly Testing)',
    roomId: 'room-b201',
    roomName: 'Hall B-201',
    classroomQrScanned: 'MANUAL_AUTH_OVERRIDE_REGISTRAR',
    status: 'Manual Override',
    method: 'Manual Fallback',
    graceWindowMinutes: 15,
    verifiedAt: '2026-11-12T09:05:30Z',
    notes: 'Camera autofocus failure on staff tablet. Authorized by Ustadh Registrar.',
  },
];

export const MOCK_HISTORICAL_SESSIONS: HistoricalAttendanceSession[] = [
  {
    id: 'sess-01',
    sessionCode: 'SES-20261116-P1-10A',
    date: '2026-11-16',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    classId: 'cls-10a',
    className: 'Class 10-A (Tahfeez Stream)',
    subject: 'Hifz & Muraja’ah (Juz 25 to 27)',
    roomId: 'room-b201',
    roomName: 'Hall B-201',
    teacherId: 'tch-2026-042',
    teacherName: 'Ustadh Sheikh Abdullah Farooq',
    teacherVerifiedAt: '07:56 AM (QR Scanned)',
    teacherStatus: 'Verified On-Time',
    totalEnrolled: 10,
    presentCount: 8,
    lateCount: 1,
    excusedCount: 1,
    absentCount: 0,
    attendanceRate: 90.0,
    isSealed: true,
    sealedAt: '08:46 AM',
    roster: [
      { studentId: 'st-01', rollNo: 'STU-10A-01', name: 'Muhammad Bilal Riyaz', status: 'Present', scannedTime: '08:02 AM', method: 'Barcode Scan' },
      { studentId: 'st-02', rollNo: 'STU-10A-02', name: 'Zaid Abdul Rahman', status: 'Present', scannedTime: '08:04 AM', method: 'Barcode Scan' },
      { studentId: 'st-03', rollNo: 'STU-10A-03', name: 'Omar Farooq Naushad', status: 'Late', scannedTime: '08:18 AM', method: 'Barcode Scan', remarks: 'Late arrival - 18 mins' },
      { studentId: 'st-04', rollNo: 'STU-10A-04', name: 'Ahmed Hamza Shiyam', status: 'Present', scannedTime: '08:01 AM', method: 'Barcode Scan' },
      { studentId: 'st-05', rollNo: 'STU-10A-05', name: 'Ibrahim Khalid Fazal', status: 'Excused', method: 'Teacher Manual', remarks: 'Certified medical notice' },
      { studentId: 'st-06', rollNo: 'STU-10A-06', name: 'Abdullah Tariq Mansoor', status: 'Present', scannedTime: '08:05 AM', method: 'Barcode Scan' },
      { studentId: 'st-07', rollNo: 'STU-10A-07', name: 'Hasan Basheer Rizwan', status: 'Present', scannedTime: '08:03 AM', method: 'Barcode Scan' },
      { studentId: 'st-08', rollNo: 'STU-10A-08', name: 'Yusuf Imtiaz Al-Hadi', status: 'Present', scannedTime: '08:07 AM', method: 'Barcode Scan' },
      { studentId: 'st-09', rollNo: 'STU-10A-09', name: 'Hamid Luqman Shibly', status: 'Present', scannedTime: '08:01 AM', method: 'Barcode Scan' },
      { studentId: 'st-10', rollNo: 'STU-10A-10', name: 'Musthafa Kamal Nizam', status: 'Present', scannedTime: '08:06 AM', method: 'Barcode Scan' },
    ],
  },
  {
    id: 'sess-02',
    sessionCode: 'SES-20261114-P1-11B',
    date: '2026-11-14',
    period: 1,
    timeSlot: '08:00 AM – 08:45 AM',
    classId: 'cls-11b',
    className: 'Class 11-B (Alimiyyah Year 2)',
    subject: 'Tafseer & Linguistic Exegesis',
    roomId: 'room-104',
    roomName: 'Lecture Hall 104',
    teacherId: 'tch-2026-042',
    teacherName: 'Ustadh Sheikh Abdullah Farooq',
    teacherVerifiedAt: '08:02 AM (QR Scanned)',
    teacherStatus: 'Verified On-Time',
    totalEnrolled: 8,
    presentCount: 6,
    lateCount: 1,
    excusedCount: 1,
    absentCount: 0,
    attendanceRate: 87.5,
    isSealed: true,
    sealedAt: '08:48 AM',
    roster: [
      { studentId: 'st-11', rollNo: 'STU-11B-01', name: 'Tariq Jameel Al-Hadi', status: 'Present', scannedTime: '08:02 AM', method: 'Barcode Scan' },
      { studentId: 'st-12', rollNo: 'STU-11B-02', name: 'Salmanul Farisi Ashraff', status: 'Present', scannedTime: '08:03 AM', method: 'Barcode Scan' },
      { studentId: 'st-13', rollNo: 'STU-11B-03', name: 'Hussain Ali Rizwan', status: 'Absent', method: 'Teacher Manual', remarks: 'Unexcused absence' },
      { studentId: 'st-14', rollNo: 'STU-11B-04', name: 'Ammar Yasir Al-Bukhari', status: 'Present', scannedTime: '08:01 AM', method: 'Barcode Scan' },
      { studentId: 'st-15', rollNo: 'STU-11B-05', name: 'Nawfal Zubair Qasim', status: 'Late', scannedTime: '08:14 AM', method: 'Barcode Scan' },
      { studentId: 'st-16', rollNo: 'STU-11B-06', name: 'Uthman Affan Majeed', status: 'Present', scannedTime: '08:04 AM', method: 'Barcode Scan' },
      { studentId: 'st-17', rollNo: 'STU-11B-07', name: 'Talha Ubaidullah Shafi', status: 'Excused', method: 'Teacher Manual', remarks: 'Bereavement leave' },
      { studentId: 'st-18', rollNo: 'STU-11B-08', name: 'Saad Waqqas Al-Basri', status: 'Present', scannedTime: '08:05 AM', method: 'Barcode Scan' },
    ],
  },
  {
    id: 'sess-03',
    sessionCode: 'SES-20261113-P2-12A',
    date: '2026-11-13',
    period: 2,
    timeSlot: '09:00 AM – 09:45 AM',
    classId: 'cls-12a',
    className: 'Class 12-A (Advanced Shariah)',
    subject: 'Khutbah Preparation & Delivery Workshop',
    roomId: 'room-aud',
    roomName: 'Main Auditorium',
    teacherId: 'tch-2026-042',
    teacherName: 'Ustadh Sheikh Abdullah Farooq',
    teacherVerifiedAt: '09:01 AM (QR Scanned)',
    teacherStatus: 'Verified On-Time',
    totalEnrolled: 6,
    presentCount: 5,
    lateCount: 0,
    excusedCount: 0,
    absentCount: 1,
    attendanceRate: 83.3,
    isSealed: true,
    sealedAt: '09:47 AM',
    roster: [
      { studentId: 'st-31', rollNo: 'STU-12A-01', name: 'Anas Zubair Ashraff', status: 'Present', scannedTime: '09:02 AM', method: 'Barcode Scan' },
      { studentId: 'st-32', rollNo: 'STU-12A-02', name: 'Musab Umair Hilmy', status: 'Present', scannedTime: '09:03 AM', method: 'Barcode Scan' },
      { studentId: 'st-33', rollNo: 'STU-12A-03', name: 'Hudhaifa Qatadah Junaid', status: 'Present', scannedTime: '09:01 AM', method: 'Barcode Scan' },
      { studentId: 'st-34', rollNo: 'STU-12A-04', name: 'Suhayb Roomi Ilyas', status: 'Present', scannedTime: '09:04 AM', method: 'Barcode Scan' },
      { studentId: 'st-35', rollNo: 'STU-12A-05', name: 'Abu Bakr Siddiq Faleel', status: 'Absent', method: 'Teacher Manual' },
      { studentId: 'st-36', rollNo: 'STU-12A-06', name: 'Miqdad Amr Luqman', status: 'Present', scannedTime: '09:05 AM', method: 'Barcode Scan' },
    ],
  },
];

export const MOCK_NOTIFICATIONS: TeacherNotification[] = [
  {
    id: 'notif-1',
    title: 'Mid-Term Exam Evaluation Schedule Released',
    message: 'The academic coordination committee has finalized the Mid-Term examination schedule for Semester 2. Please submit your drafted question papers by Friday, 20 November.',
    category: 'Exam',
    priority: 'High',
    timestamp: '2 hours ago',
    isRead: false,
    sender: 'Academic Directorate',
  },
  {
    id: 'notif-2',
    title: 'Faculty Monthly Consultative Assembly',
    message: 'All senior Ustadhs are requested to attend the monthly academic assembly tomorrow at 02:00 PM in the Faculty Conference Hall.',
    category: 'Administrative',
    priority: 'Normal',
    timestamp: 'Yesterday at 04:30 PM',
    isRead: false,
    sender: 'Principal Office',
  },
  {
    id: 'notif-3',
    title: 'Class 10-A Recitation Hall Maintenance',
    message: 'Hall B-201 audio recording microphones have been inspected and calibrated for crystal-clear tajweed phonetics recording.',
    category: 'Academic',
    priority: 'Low',
    timestamp: '14 Nov 2026',
    isRead: true,
    sender: 'IT & Facilities',
  },
  {
    id: 'notif-4',
    title: 'Emergency Medical Leave Form: Student Ibrahim Khalid',
    message: 'Guardian of Ibrahim Khalid (Class 10-A) submitted medical leave certificate for 16-17 November. Absence has been pre-authorized as Excused.',
    category: 'Academic',
    priority: 'Normal',
    timestamp: '13 Nov 2026',
    isRead: true,
    sender: 'Student Affairs',
  },
  {
    id: 'notif-5',
    title: 'Digital Library Access Upgraded',
    message: 'The institutional subscription to Shamela & Maktabah Rashidiyyah digital catalog has been renewed with 12,000 additional classical manuscripts.',
    category: 'Academic',
    priority: 'Low',
    timestamp: '11 Nov 2026',
    isRead: true,
    sender: 'Central Library',
  },
];

export const MOCK_TEACHER_STATS = {
  totalClasses: 4,
  totalStudents: 30,
  weeklyTeachingHours: 18,
  averageAttendanceRate: 94.6,
  syllabusCompletionRate: 68.8,
  pendingEvaluations: 8,
  todayTotalSessions: 4,
  todayCompletedSessions: 1,
};

// ==========================================
// Phase 3: Salary & Payslips Data Interfaces
// ==========================================

export interface SalaryItem {
  name: string;
  category: string;
  amount: number;
  description?: string;
}

export interface SalaryAdjustment {
  name: string;
  type: 'Addition' | 'Deduction';
  amount: number;
  remarks: string;
}

export interface SalaryOverviewData {
  basicSalary: number;
  allowances: SalaryItem[];
  adjustments: SalaryAdjustment[];
  deductions: SalaryItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  currency: string;
  currentStatus: 'Paid' | 'Processing' | 'Pending';
  latestPaymentMonth: string;
  latestPaymentDate: string;
  epfNumber: string;
  bankDetails: {
    bankName: string;
    branch: string;
    accountNumber: string;
    accountHolder: string;
  };
  monthlyTrends: Array<{
    month: string;
    basic: number;
    allowances: number;
    deductions: number;
    net: number;
    status: 'Paid' | 'Processing' | 'Pending';
  }>;
}

export interface PaymentHistoryRecord {
  id: string;
  month: string;
  monthCode: string;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  paymentDate: string;
  paymentMethod: string;
  paymentReference: string;
  transactionId: string;
  status: 'Paid' | 'Processing' | 'Pending';
  disbursementChannel: string;
  bankSummary: string;
}

export interface DetailedPayslip {
  id: string;
  payslipNumber: string;
  monthYear: string;
  monthCode: string;
  issueDate: string;
  disbursementDate: string;
  workingDays: number;
  lecturesConducted: number;
  attendanceRate: number;
  basicSalary: number;
  allowances: SalaryItem[];
  adjustments: SalaryAdjustment[];
  grossEarnings: number;
  deductions: SalaryItem[];
  totalDeductions: number;
  netPayable: number;
  netPayableWords: string;
  paymentMethod: string | null;
  bankName: string | null;
  bankBranch: string | null;
  accountNumber: string | null;
  paymentReference: string | null;
  authorizedSignatory: string | null;
  authorizedTitle: string | null;
  status: 'Paid' | 'Processing' | 'Pending';
}

export const MOCK_SALARY_OVERVIEW: SalaryOverviewData = {
  basicSalary: 85000,
  allowances: [
    { name: 'Academic Research & Pedagogy', category: 'Academic', amount: 12000, description: 'Support for classical manuscripts & curriculum preparation (Sample)' },
    { name: 'Faculty Residential / Housing', category: 'Housing', amount: 8000, description: 'Institutional housing stipend (Sample)' },
    { name: 'Special Ten Qira’at Ijazah Allowance', category: 'Special', amount: 6000, description: 'Certified Ijazah faculty credential incentive (Sample)' },
    { name: 'Transport & Inter-Campus Travel', category: 'Transport', amount: 5000, description: 'Commuter allowance between Kalutara and Colombo (Sample)' },
  ],
  adjustments: [],
  deductions: [
    { name: 'Employee EPF Contribution (8%)', category: 'Statutory EPF', amount: 6800, description: 'Statutory employee provident fund deduction (Sample)' },
    { name: 'Staff Welfare & Benevolent Fund', category: 'Welfare', amount: 1200, description: 'Madrasa faculty internal benevolent trust (Sample)' },
    { name: 'Group Health Takaful Scheme', category: 'Takaful', amount: 2000, description: 'Family medical takaful cover (Sample)' },
  ],
  grossSalary: 116000,
  totalDeductions: 10000,
  netSalary: 106000,
  currency: 'Rs.',
  currentStatus: 'Paid',
  latestPaymentMonth: 'October 2026',
  latestPaymentDate: '31 Oct 2026',
  epfNumber: 'SAMPLE-EPF-7841',
  bankDetails: {
    bankName: 'Bank of Ceylon (BOC) - Sample Account',
    branch: 'Kalutara South Branch (Sample Code 042)',
    accountNumber: 'SAMPLE-BOC-****-4910',
    accountHolder: 'Sheikh Abdullah Farooq (Sample Account)',
  },
  monthlyTrends: [
    { month: 'May 2026', basic: 85000, allowances: 29000, deductions: 9800, net: 104200, status: 'Paid' },
    { month: 'Jun 2026', basic: 85000, allowances: 29000, deductions: 9800, net: 104200, status: 'Paid' },
    { month: 'Jul 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
    { month: 'Aug 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
    { month: 'Sep 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
    { month: 'Oct 2026', basic: 85000, allowances: 31000, deductions: 10000, net: 106000, status: 'Paid' },
  ],
};

export const MOCK_PAYMENT_HISTORY: PaymentHistoryRecord[] = [
  {
    id: 'pay-2026-10',
    month: 'October 2026',
    monthCode: '2026-10',
    grossSalary: 116000,
    deductions: 10000,
    netSalary: 106000,
    paymentDate: '2026-10-31',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-10-UST042',
    transactionId: 'SAMPLE-TXN-8849201',
    status: 'Paid',
    disbursementChannel: 'Sri Lanka Interbank Payment System (SLIPS) - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
  {
    id: 'pay-2026-09',
    month: 'September 2026',
    monthCode: '2026-09',
    grossSalary: 116000,
    deductions: 10000,
    netSalary: 106000,
    paymentDate: '2026-09-30',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-09-UST042',
    transactionId: 'SAMPLE-TXN-7731940',
    status: 'Paid',
    disbursementChannel: 'Sri Lanka Interbank Payment System (SLIPS) - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
  {
    id: 'pay-2026-08',
    month: 'August 2026',
    monthCode: '2026-08',
    grossSalary: 116000,
    deductions: 10000,
    netSalary: 106000,
    paymentDate: '2026-08-31',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-08-UST042',
    transactionId: 'SAMPLE-TXN-6629104',
    status: 'Paid',
    disbursementChannel: 'Sri Lanka Interbank Payment System (SLIPS) - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
  {
    id: 'pay-2026-07',
    month: 'July 2026',
    monthCode: '2026-07',
    grossSalary: 116000,
    deductions: 10000,
    netSalary: 106000,
    paymentDate: '2026-07-31',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-07-UST042',
    transactionId: 'SAMPLE-TXN-5518290',
    status: 'Paid',
    disbursementChannel: 'Sri Lanka Interbank Payment System (SLIPS) - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
  {
    id: 'pay-2026-06',
    month: 'June 2026',
    monthCode: '2026-06',
    grossSalary: 114000,
    deductions: 9800,
    netSalary: 104200,
    paymentDate: '2026-06-30',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-06-UST042',
    transactionId: 'SAMPLE-TXN-4407183',
    status: 'Paid',
    disbursementChannel: 'Sri Lanka Interbank Payment System (SLIPS) - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
  {
    id: 'pay-2026-05',
    month: 'May 2026',
    monthCode: '2026-05',
    grossSalary: 114000,
    deductions: 9800,
    netSalary: 104200,
    paymentDate: '2026-05-31',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-05-UST042',
    transactionId: 'SAMPLE-TXN-3396072',
    status: 'Paid',
    disbursementChannel: 'Sri Lanka Interbank Payment System (SLIPS) - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
  {
    id: 'pay-2026-11-est',
    month: 'November 2026 (Upcoming)',
    monthCode: '2026-11',
    grossSalary: 116000,
    deductions: 10000,
    netSalary: 106000,
    paymentDate: '2026-11-30 (Estimated)',
    paymentMethod: 'Direct Bank Deposit',
    paymentReference: 'SAMPLE-PAY-2026-11-EST042',
    transactionId: 'SAMPLE-PENDING-DISBURSEMENT',
    status: 'Processing',
    disbursementChannel: 'Scheduled Payroll Run - Sample',
    bankSummary: 'Sample Account • BOC ending in 4910',
  },
];

export const MOCK_PAYSLIPS: DetailedPayslip[] = [
  {
    id: 'ps-2026-10',
    payslipNumber: 'SAMPLE-PSL-2026-10-042',
    monthYear: 'October 2026',
    monthCode: '2026-10',
    issueDate: '2026-10-31',
    disbursementDate: '2026-10-31',
    workingDays: 22,
    lecturesConducted: 48,
    attendanceRate: 98.2,
    basicSalary: 85000,
    allowances: [
      { name: 'Academic Research & Pedagogy', category: 'Academic', amount: 12000, description: 'Classical literature & syllabus preparation (Sample)' },
      { name: 'Faculty Housing Allowance', category: 'Housing', amount: 8000, description: 'Institutional housing stipend (Sample)' },
      { name: 'Special Ten Qira’at Ijazah Allowance', category: 'Special', amount: 6000, description: 'Certified Ijazah faculty credential incentive (Sample)' },
      { name: 'Transport & Inter-Campus Travel', category: 'Transport', amount: 5000, description: 'Commuter allowance between Kalutara and Colombo (Sample)' },
    ],
    adjustments: [],
    grossEarnings: 116000,
    deductions: [
      { name: 'Employee EPF Contribution (8%)', category: 'Statutory EPF', amount: 6800, description: 'Employee Provident Fund statutory deduction (Sample)' },
      { name: 'Staff Welfare & Benevolent Fund', category: 'Welfare', amount: 1200, description: 'Madrasa internal mutual support fund (Sample)' },
      { name: 'Group Health Takaful Scheme', category: 'Takaful', amount: 2000, description: 'Family medical takaful cover (Sample)' },
    ],
    totalDeductions: 10000,
    netPayable: 106000,
    netPayableWords: 'One Hundred and Six Thousand Sri Lankan Rupees Only',
    paymentMethod: 'Direct Bank Deposit (SLIPS)',
    bankName: 'Bank of Ceylon (BOC)',
    bankBranch: 'Kalutara South Branch (Sample 042)',
    accountNumber: 'SAMPLE-BOC-****-4910',
    paymentReference: 'SAMPLE-PAY-2026-10-UST042',
    authorizedSignatory: 'Sample Bursar (Illustrative Placeholder)',
    authorizedTitle: 'Finance Directorate (Illustrative Role)',
    status: 'Paid',
  },
  {
    id: 'ps-2026-09',
    payslipNumber: 'SAMPLE-PSL-2026-09-042',
    monthYear: 'September 2026',
    monthCode: '2026-09',
    issueDate: '2026-09-30',
    disbursementDate: '2026-09-30',
    workingDays: 21,
    lecturesConducted: 44,
    attendanceRate: 97.5,
    basicSalary: 85000,
    allowances: [
      { name: 'Academic Research & Pedagogy', category: 'Academic', amount: 12000 },
      { name: 'Faculty Housing Allowance', category: 'Housing', amount: 8000 },
      { name: 'Special Ten Qira’at Ijazah Allowance', category: 'Special', amount: 6000 },
      { name: 'Transport & Inter-Campus Travel', category: 'Transport', amount: 5000 },
    ],
    adjustments: [],
    grossEarnings: 116000,
    deductions: [
      { name: 'Employee EPF Contribution (8%)', category: 'Statutory EPF', amount: 6800 },
      { name: 'Staff Welfare & Benevolent Fund', category: 'Welfare', amount: 1200 },
      { name: 'Group Health Takaful Scheme', category: 'Takaful', amount: 2000 },
    ],
    totalDeductions: 10000,
    netPayable: 106000,
    netPayableWords: 'One Hundred and Six Thousand Sri Lankan Rupees Only',
    paymentMethod: 'Direct Bank Deposit (SLIPS)',
    bankName: 'Bank of Ceylon (BOC)',
    bankBranch: 'Kalutara South Branch (Sample 042)',
    accountNumber: 'SAMPLE-BOC-****-4910',
    paymentReference: 'SAMPLE-PAY-2026-09-UST042',
    authorizedSignatory: 'Sample Bursar (Illustrative Placeholder)',
    authorizedTitle: 'Finance Directorate (Illustrative Role)',
    status: 'Paid',
  },
  {
    id: 'ps-2026-08',
    payslipNumber: 'SAMPLE-PSL-2026-08-042',
    monthYear: 'August 2026',
    monthCode: '2026-08',
    issueDate: '2026-08-31',
    disbursementDate: '2026-08-31',
    workingDays: 22,
    lecturesConducted: 46,
    attendanceRate: 98.0,
    basicSalary: 85000,
    allowances: [
      { name: 'Academic Research & Pedagogy', category: 'Academic', amount: 12000 },
      { name: 'Faculty Housing Allowance', category: 'Housing', amount: 8000 },
      { name: 'Special Ten Qira’at Ijazah Allowance', category: 'Special', amount: 6000 },
      { name: 'Transport & Inter-Campus Travel', category: 'Transport', amount: 5000 },
    ],
    adjustments: [],
    grossEarnings: 116000,
    deductions: [
      { name: 'Employee EPF Contribution (8%)', category: 'Statutory EPF', amount: 6800 },
      { name: 'Staff Welfare & Benevolent Fund', category: 'Welfare', amount: 1200 },
      { name: 'Group Health Takaful Scheme', category: 'Takaful', amount: 2000 },
    ],
    totalDeductions: 10000,
    netPayable: 106000,
    netPayableWords: 'One Hundred and Six Thousand Sri Lankan Rupees Only',
    paymentMethod: 'Direct Bank Deposit (SLIPS)',
    bankName: 'Bank of Ceylon (BOC)',
    bankBranch: 'Kalutara South Branch (Sample 042)',
    accountNumber: 'SAMPLE-BOC-****-4910',
    paymentReference: 'SAMPLE-PAY-2026-08-UST042',
    authorizedSignatory: 'Sample Bursar (Illustrative Placeholder)',
    authorizedTitle: 'Finance Directorate (Illustrative Role)',
    status: 'Paid',
  },
];
