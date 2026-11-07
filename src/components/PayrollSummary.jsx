import { formatCOP, formatHours, formatNumber } from '../utils/format.js';

const EARNINGS = [
  ['ordinaryDiurnal', 'Ordinarias diurnas'],
  ['ordinaryNocturnal', 'Ordinarias nocturnas'],
  ['overtimeDiurnal', 'Extras diurnas'],
  ['overtimeNocturnal', 'Extras nocturnas'],
  ['sundayHolidayDiurnal', 'Dom./festivo diurno'],
  ['sundayHolidayNocturnal', 'Dom./festivo nocturno'],
  ['transportAllowance', 'Auxilio de transporte'],
];

const DEDUCTIONS = [
  ['health', 'Salud (4%)'],
  ['pension', 'Pensión (4%)'],
];

const BENEFITS = [
  ['severance', 'Cesantías (8.33%)'],
  ['severanceInterest', 'Intereses cesantías (1%)'],
  ['prima', 'Prima (8.33%)'],
  ['vacation', 'Vacaciones (4.17%)'],
];

function Rows({ items, source, hours, accent = false }) {
  return items
    .filter(([key]) => source[key] !== 0)
    .map(([key, label]) => (
      <tr key={key}>
        <td className="text-secondary">
          {label}
          {hours?.[key] > 0 && (
            <span className="ha-hours ms-1">({formatHours(hours[key])})</span>
          )}
        </td>
        <td className={`text-end tabular fw-semibold ${accent ? 'text-danger' : ''}`}>
          {formatCOP(source[key])}
        </td>
      </tr>
    ));
}

function Stat({ label, value, icon, variant }) {
  return (
    <div className={`card ha-stat ha-stat-${variant}`}>
      <div className="card-body p-3">
        <div className="d-flex align-items-center justify-content-between mb-1">
          <span className="small fw-semibold opacity-75">{label}</span>
          <i className={`bi ${icon}`} />
        </div>
        <div className="h5 fw-bold mb-0 tabular">{value}</div>
      </div>
    </div>
  );
}

export default function PayrollSummary({ result }) {
  const { earnings, deductions, benefits, hours, totals, meta } = result;

  return (
    <div className="d-flex flex-column gap-3">
      {totals.gross > 0 ? (
        <div className="row g-3 rise">
          <div className="col-12">
            <Stat
              label="Total devengado"
              value={formatCOP(totals.gross)}
              icon="bi-wallet2"
              variant="primary"
            />
          </div>
          <div className="col-6">
            <Stat
              label="Deducciones"
              value={`-${formatCOP(deductions.total)}`}
              icon="bi-arrow-down-circle"
              variant="danger"
            />
          </div>
          <div className="col-6">
            <Stat
              label="Neto a pagar"
              value={formatCOP(totals.net)}
              icon="bi-cash-stack"
              variant="success"
            />
          </div>
        </div>
      ) : (
        <div className="alert alert-info py-2 small mb-0 rise" role="status">
          <i className="bi bi-info-circle me-1" />
          Sin devengos en el periodo seleccionado.
        </div>
      )}

      <div className="card ha-card rise">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <h2 className="h6 fw-bold text-uppercase text-secondary mb-0">Resumen</h2>
            <span className="badge text-bg-light border">
              {formatNumber(hours.total, 0)} h · {formatCOP(totals.effectiveHourlyRate)}/h efectivo
            </span>
          </div>

          {meta && (
            <p className="small text-secondary mb-3">
              <i className="bi bi-calendar2-range me-1" />
              {meta.from} → {meta.to} · {meta.shiftCount} turnos · {meta.daysWorked} días laborados
            </p>
          )}

          <div className="d-grid gap-4">
            <div>
              <h3 className="small fw-bold text-indigo mb-1">Devengos</h3>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    <Rows items={EARNINGS} source={earnings} hours={hours.byCategory} />
                    <tr className="table-light">
                      <td className="fw-bold">Total</td>
                      <td className="text-end fw-bold tabular">{formatCOP(earnings.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="small fw-bold text-indigo mb-1">
                Deducciones
                <span className="text-secondary fw-normal"> · IBC {formatCOP(totals.ibc)}</span>
              </h3>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <tbody>
                    <Rows items={DEDUCTIONS} source={deductions} accent />
                    <tr className="table-light">
                      <td className="fw-bold">Total</td>
                      <td className="text-end fw-bold tabular text-danger">
                        -{formatCOP(deductions.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {benefits.total > 0 && (
              <div>
                <h3 className="small fw-bold text-indigo mb-1">
                  Prestaciones acumuladas
                  <span className="text-secondary fw-normal"> · no se descuentan</span>
                </h3>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <tbody>
                      <Rows items={BENEFITS} source={benefits} />
                      <tr className="table-light">
                        <td className="fw-bold">Total</td>
                        <td className="text-end fw-bold tabular">{formatCOP(benefits.total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <p className="form-text small mt-3 mb-0">
            Horas: {formatNumber(hours.ordinary)} ordinarias · {formatNumber(hours.overtime)}{' '}
            extras · {formatNumber(hours.sundayHoliday)} dominicales/festivas.
          </p>
        </div>
      </div>
    </div>
  );
}
