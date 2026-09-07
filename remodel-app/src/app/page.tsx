export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
        padding: '48px 24px',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          background: 'rgba(255,255,255,0.78)',
          border: '1px solid rgba(148,163,184,0.35)',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)',
          padding: '48px 32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 48,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-block',
                background: '#e2e8f0',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.2,
                padding: '8px 12px',
                borderRadius: 999,
                marginBottom: 12,
              }}
            >
              REMODEL PLATFORM
            </div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', margin: 0, lineHeight: 1.05 }}>
              Client portal for home renovation projects.
            </h1>
          </div>

          <div
            style={{
              background: '#0f172a',
              color: 'white',
              borderRadius: 16,
              padding: '18px 20px',
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1.2 }}>
              Current status
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>Live</div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
            marginBottom: 36,
          }}
        >
          {[
            { label: 'Active projects', value: '12' },
            { label: 'Approved', value: '8' },
            { label: 'Pending review', value: '4' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 18,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 14, color: '#475569' }}>{item.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, marginTop: 10 }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 36,
          }}
        >
          <button
            style={{
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '14px 22px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            View projects
          </button>
          <button
            style={{
              background: 'transparent',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '14px 22px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Book a consult
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}
        >
          {[
            'Proposal approvals',
            'Design change tracking',
            'Budget and timeline visibility',
          ].map((feature) => (
            <div
              key={feature}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 18,
                padding: 22,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{feature}</div>
              <div style={{ color: '#475569', lineHeight: 1.6 }}>
                A cleaner way to keep clients informed, approved, and ready for next steps.
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
