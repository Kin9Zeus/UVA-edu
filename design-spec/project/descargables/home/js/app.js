/* app.js — estado y lógica de la aplicación U.V.A.
   Los valores devueltos por renderVals() alimentan los {{ huecos }} de index.html. */
class Component extends DCLogic {
  state = {
    view: 'landing', authView: 'login', regStep: 1,
    email: '', pass: '', pass2: '', name: '', role: '', error: '',
    userName: 'Daniela Arango',
    screen: 'landing', collapsed: false, temarioOpen: false,
    menuOpen: false, savedProfile: false, preview: null, tab: 'recursos',
    profile: {
      name: 'Daniela Arango', email: 'daniela.arango@estudio.co', role: 'Presupuestadora',
      country: 'Colombia', handle: 'daniela', software: 'Revit, Excel, AutoCAD',
      bio: 'Presupuesto obra residencial en Antioquia. Aprendiendo BIM para licitaciones.'
    },
    current: 7,
    done: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }
  };

  lessonData = [
    [1, 'Qué es y qué no es un presupuesto', '08:12'],
    [2, 'Documentos que necesitas del proyecto', '11:40'],
    [3, 'Lectura rápida de planos', '17:05'],
    [4, 'Estructura del capítulo de obra', '15:20'],
    [5, 'Anatomía de un APU', '21:18'],
    [6, 'Rendimientos: de dónde salen', '19:02'],
    [7, 'APU de mampostería', '29:40'],
    [8, 'Desperdicios y factores de obra', '13:44'],
    [9, 'AIU: administración, imprevistos y utilidad', '24:11'],
    [10, 'Cómo defender tu precio', '18:33']
  ];

  certs = [
    { kind: 'Certificado de curso', title: 'Cantidades de obra sin errores', date: '12 de julio de 2026', code: 'UVA-CNT-8F3K21', meta: '14 horas de contenido · nota 94/100' },
    { kind: 'Certificado de curso', title: 'Lectura de planos estructurales', date: '3 de junio de 2026', code: 'UVA-PLN-2D9Q77', meta: '11 horas de contenido · nota 88/100' },
    { kind: 'Certificado de ruta', title: 'Residente de obra: primeros 90 días', date: '28 de junio de 2026', code: 'UVA-RUT-55XB04', meta: '7 cursos · 62 horas de formación' }
  ];

  openPreview = (i) => (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ preview: i }); };

  setP = (k) => (e) => this.setState((s) => ({ profile: { ...s.profile, [k]: e.target.value }, savedProfile: false }));

  toggleLesson = (n) => () =>
    this.setState((s) => ({ done: { ...s.done, [n]: !s.done[n] } }));

  componentDidMount() { this.applyTheme(); }
  componentDidUpdate() { this.applyTheme(); }

  applyTheme() {
    const r = document.documentElement.style;
    r.setProperty('--color-text', this.props.textTone ?? '#FAFAFA');
    r.setProperty('--color-accent', this.props.accent ?? '#FF007A');
    r.setProperty('--note-d', (this.props.showNotes ?? true) ? 'inline-flex' : 'none');
  }

  set = (k) => (e) => this.setState({ [k]: e.target.value, error: '' });
  go = (s) => (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ screen: s, temarioOpen: false, menuOpen: false }); };

  submitReg = () => {
    const { email, pass, pass2 } = this.state;
    if (!/^\S+@\S+\.\S+$/.test(email)) return this.setState({ error: 'Introduce un correo válido.' });
    if (pass.length < 8) return this.setState({ error: 'La contraseña necesita al menos 8 caracteres.' });
    if (pass !== pass2) return this.setState({ error: 'Las contraseñas no coinciden.' });
    this.setState({ regStep: 2, error: '' });
  };

  submitName = () => {
    if (this.state.name.trim().length < 3) return this.setState({ error: 'Escribe tu nombre completo.' });
    const name = this.state.name.trim();
    this.setState((s) => ({
      view: 'app', userName: name, screen: 'home', error: '',
      profile: { ...s.profile, name, email: s.email || s.profile.email, role: s.role || s.profile.role, handle: name.split(' ')[0].toLowerCase() }
    }));
  };

  renderVals() {
    const s = this.state;
    const dim = '#A1A1AA';
    const act = '#FAFAFA';
    const on = (k) => (s.screen === k ? act : dim);
    const bg = (k) => (s.screen === k ? '#18181B' : 'transparent');
    const bar = (k) => (s.screen === k ? 'var(--color-accent)' : 'transparent');
    const first = (s.userName || '').split(' ')[0];
    const placeholders = { comentarios: 'Comentarios', notificaciones: 'Notificaciones' };
    return {
      notAuthed: s.view === 'auth',
      isLanding: s.view === 'landing',
      showApp: s.view === 'app',
      goLanding: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'landing' }); },
      logout: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ view: 'landing', screen: 'home', authView: 'login', regStep: 1, email: '', pass: '', pass2: '', name: '', error: '' }); },
      isLogin: !s.authed && s.authView === 'login',
      isRegistro: !s.authed && s.authView === 'registro',
      isRegStep1: s.regStep === 1, isRegStep2: s.regStep === 2,
      regStep: s.regStep,
      regStepLabel: s.regStep === 1 ? 'correo y contraseña' : 'tus datos',
      step2Bar: s.regStep === 2 ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text) 14%, transparent)',
      pass2Border: s.pass2 && s.pass !== s.pass2 ? 'var(--color-accent)' : 'var(--color-divider)',
      email: s.email, pass: s.pass, pass2: s.pass2, name: s.name, role: s.role,
      error: s.error, hasError: !!s.error,
      setEmail: this.set('email'), setPass: this.set('pass'), setPass2: this.set('pass2'),
      setName: this.set('name'), setRole: this.set('role'),
      submitReg: this.submitReg, submitName: this.submitName,
      backReg: () => this.setState({ regStep: 1, error: '' }),
      goRegistro: (e) => { e.preventDefault(); this.setState({ view: 'auth', authView: 'registro', regStep: 1, error: '' }); },
      openAuth: (e) => { if (e && e.preventDefault) e.preventDefault(); window.location.href = 'iniciarsesion-crearusuario.html'; },
      irALogin: (e) => { if (e && e.preventDefault) e.preventDefault(); window.location.href = 'iniciarsesion-crearusuario.html'; },
      goLogin: (e) => { e.preventDefault(); this.setState({ view: 'auth', authView: 'login', error: '' }); },
      doLogin: () => this.setState({ view: 'app', screen: 'home' }),
      googleLogin: () => this.setState({ view: 'app', screen: 'home' }),

      userName: s.userName, userFirst: first,
      userInitial: (s.userName || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(''),
      handle: (first || 'tu').toLowerCase(),
      sidebarWidth: s.collapsed ? '76px' : '248px',
      labelDisplay: s.collapsed ? 'none' : 'block',
      toggleSidebar: () => this.setState({ collapsed: !s.collapsed }),
      toggleTemario: () => this.setState({ temarioOpen: !s.temarioOpen }),
      temarioOpen: s.temarioOpen,

      lessons: this.lessonData.map(([n, title, dur]) => {
        const isDone = !!s.done[n];
        const isCur = n === s.current;
        return {
          n, title: n + ' · ' + title, dur,
          mark: isDone ? '✓' : '',
          ring: isDone ? 'var(--color-accent-2)' : isCur ? 'var(--color-accent)' : '#3F3F46',
          fill: isDone ? 'var(--color-accent-2)' : 'transparent',
          tick: '#09090B',
          bg: isCur ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
          toggle: this.toggleLesson(n)
        };
      }),
      doneCount: Object.values(s.done).filter(Boolean).length,
      pct: Math.round((Object.values(s.done).filter(Boolean).length / 18) * 100),
      pctW: Math.round((Object.values(s.done).filter(Boolean).length / 18) * 100) + '%',
      completeLabel: s.done[s.current] ? 'Clase ' + s.current + ' completada ✓' : 'Marcar clase ' + s.current + ' como completada',
      completeCurrent: this.toggleLesson(s.current),

      previewOpen: s.preview !== null,
      pvKind: s.preview !== null ? this.certs[s.preview].kind : '',
      pvTitle: s.preview !== null ? this.certs[s.preview].title : '',
      pvDate: s.preview !== null ? this.certs[s.preview].date : '',
      pvCode: s.preview !== null ? this.certs[s.preview].code : '',
      pvMeta: s.preview !== null ? this.certs[s.preview].meta : '',
      openPreview0: this.openPreview(0), openPreview1: this.openPreview(1), openPreview2: this.openPreview(2),
      closePreview: () => this.setState({ preview: null }),
      tabRecursos: s.tab === 'recursos', tabResumen: s.tab === 'resumen', tabComentarios: s.tab === 'comentarios',
      setTabR: () => this.setState({ tab: 'recursos' }),
      setTabS: () => this.setState({ tab: 'resumen' }),
      setTabC: () => this.setState({ tab: 'comentarios' }),
      tcR: s.tab === 'recursos' ? '#FAFAFA' : '#A1A1AA',
      tbR: s.tab === 'recursos' ? 'var(--color-accent)' : 'transparent',
      tcS: s.tab === 'resumen' ? '#FAFAFA' : '#A1A1AA',
      tbS: s.tab === 'resumen' ? 'var(--color-accent)' : 'transparent',
      tabClases: s.tab === 'clases',
      setTabL: () => this.setState({ tab: 'clases' }),
      tcL: s.tab === 'clases' ? '#FAFAFA' : '#A1A1AA',
      tbL: s.tab === 'clases' ? 'var(--color-accent)' : 'transparent',
      tcC: s.tab === 'comentarios' ? '#FAFAFA' : '#A1A1AA',
      tbC: s.tab === 'comentarios' ? 'var(--color-accent)' : 'transparent',

      menuOpen: s.menuOpen,
      toggleMenu: () => this.setState({ menuOpen: !s.menuOpen }),
      goPerfil: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ screen: 'perfil', menuOpen: false }); },
      isPerfil: s.screen === 'perfil',
      profileName: s.profile.name, profileEmail: s.profile.email, profileRole: s.profile.role,
      profileCountry: s.profile.country, profileHandle: s.profile.handle,
      profileSoftware: s.profile.software, profileBio: s.profile.bio,
      setPName: this.setP('name'), setPEmail: this.setP('email'), setPRole: this.setP('role'),
      setPCountry: this.setP('country'), setPHandle: this.setP('handle'),
      setPSoftware: this.setP('software'), setPBio: this.setP('bio'),
      savedProfile: s.savedProfile,
      saveProfile: () => this.setState({ userName: s.profile.name, savedProfile: true }),

      goHome: this.go('home'), goAcademia: this.go('academia'), goCurso: this.go('curso'),
      goPlayer: this.go('player'), goRutas: this.go('rutas'), goProgreso: this.go('progreso'),
      goCertificados: this.go('certificados'), goComunidad: this.go('comunidad'),
      goPrecios: this.go('precios'), goSuscripcion: this.go('suscripcion'),
      goComentarios: this.go('comentarios'), goNotificaciones: this.go('notificaciones'),

      isHome: s.screen === 'home', isAcademia: s.screen === 'academia',
      isCurso: s.screen === 'curso', isPlayer: s.screen === 'player',
      isRutas: s.screen === 'rutas', isProgreso: s.screen === 'progreso',
      isCertificados: s.screen === 'certificados', isComunidad: s.screen === 'comunidad',
      isPrecios: s.screen === 'precios', isSuscripcion: s.screen === 'suscripcion',
      isPlaceholderScreen: !!placeholders[s.screen],
      placeholderTitle: placeholders[s.screen] || '',

      cHome: on('home'), bgHome: bg('home'),
      cAcademia: on('academia'), bgAcademia: bg('academia'),
      cComunidad: on('comunidad'), bgComunidad: bg('comunidad'),
      cComentarios: on('comentarios'), bgComentarios: bg('comentarios'),
      cNotif: on('notificaciones'), bgNotif: bg('notificaciones'),
      cRutas: on('rutas'), bgRutas: bg('rutas'),
      cProgreso: on('progreso'), bgProgreso: bg('progreso'),
      cCert: on('certificados'), bgCert: bg('certificados'),
      barHome: bar('home'), barAcademia: bar('academia'), barComunidad: bar('comunidad'),
      barProgreso: bar('progreso'), barCert: bar('certificados'),
      cPerfil: on('perfil'), bgPerfil: bg('perfil'), barPerfil: bar('perfil'),
      cSusc: on('suscripcion'), bgSusc: bg('suscripcion'), barSusc: bar('suscripcion'),
      goPerfilNav: (e) => { if (e && e.preventDefault) e.preventDefault(); this.setState({ screen: 'perfil', menuOpen: false }); },
      cPrecios: on('precios'), bgPrecios: bg('precios')
    };
  }
}

document.addEventListener('DOMContentLoaded', function () {
  window.app = mountApp(Component, 'app-template', 'app');
});
