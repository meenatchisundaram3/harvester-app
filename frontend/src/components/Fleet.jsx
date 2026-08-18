import React, { useState, useEffect } from 'react';
import { db, localDb, OFFICIAL_FLEET } from '../db.js';
import { formatDate } from '../utils.js';

export default function Fleet() {
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    reg_number: '',
    vehicle_type: 'Agricultural Tractor',
    maker: 'CNH INDUSTRIAL (INDIA) PVT LTD',
    model: '',
    chassis_number: '',
    engine_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    validity_date: '2039-07-04',
    fuel_type: 'DIESEL',
    hp: '',
    status: 'Active',
    owner_name: 'SIVAKOZHUNDHU (s/o KARTHIKEYAN)',
    financer: 'STATE BANK OF INDIA ADB',
    rto: 'TN32 VILLUPURAM RTO'
  });

  useEffect(() => {
    loadFleet();
  }, []);

  const loadFleet = async () => {
    let list = await db.harvesters.toArray();
    if (list.length === 0) {
      for (const veh of OFFICIAL_FLEET) {
        await db.harvesters.put(veh);
      }
      list = await db.harvesters.toArray();
    }
    setVehicles(list);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setFormData({
      id: '',
      name: '',
      reg_number: '',
      vehicle_type: 'Agricultural Tractor',
      maker: 'CNH INDUSTRIAL (INDIA) PVT LTD',
      model: '',
      chassis_number: '',
      engine_number: '',
      purchase_date: new Date().toISOString().split('T')[0],
      validity_date: '2039-07-04',
      fuel_type: 'DIESEL',
      hp: '',
      status: 'Active',
      owner_name: 'SIVAKOZHUNDHU (s/o KARTHIKEYAN)',
      financer: 'STATE BANK OF INDIA ADB',
      rto: 'TN32 VILLUPURAM RTO'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (veh) => {
    setIsEditing(true);
    setFormData({ ...veh });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.reg_number) {
      alert('Please provide vehicle name and registration number.');
      return;
    }

    const payload = {
      ...formData,
      id: formData.id || formData.reg_number.replace(/\s+/g, '').toUpperCase()
    };

    await localDb.saveHarvester(payload);
    setShowModal(false);
    loadFleet();
  };

  return (
    <div className="fleet-view">
      {/* Header Info Banner */}
      <div className="content-card" style={{ background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)', color: '#fff', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: 'rgba(255,255,255,0.15)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
              Official Fleet Register (Tamil Nadu RTO TN32)
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.25rem', color: '#fff' }}>
              Sivakozhundhu Harvester & Tractor Fleet
            </h2>
            <p style={{ fontSize: '0.875rem', opacity: 0.85 }}>
              Valaiyampattu, Villupuram | Financed by State Bank of India ADB
            </p>
          </div>

          <button className="btn btn-secondary" onClick={handleOpenAdd} style={{ background: '#fff', color: 'var(--primary-dark)', fontWeight: '700' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add New Machinery
          </button>
        </div>
      </div>

      {/* Fleet Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {vehicles.map((v) => {
          const isHarvester = v.vehicle_type?.toLowerCase().includes('harvester') || v.name?.toLowerCase().includes('case') || v.name?.toLowerCase().includes('harvester');
          return (
            <div key={v.id} className="content-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderTop: `4px solid ${isHarvester ? '#38a169' : '#3182ce'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: isHarvester ? 'rgba(56, 161, 105, 0.12)' : 'rgba(49, 130, 206, 0.12)', color: isHarvester ? 'var(--success)' : '#3182ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isHarvester ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="17" r="4"/><circle cx="17" cy="17" r="2"/><path d="M7 17h10M5 17l1-6h6l2 6M10 5h4v6h-4z"/></svg>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)' }}>{v.name}</h3>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: isHarvester ? 'var(--success)' : '#3182ce' }}>
                      {v.vehicle_type || 'Agricultural Machinery'}
                    </span>
                  </div>
                </div>
                <span className={`badge ${v.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                  {v.status || 'Active'}
                </span>
              </div>

              {/* Number Plate Badge */}
              <div style={{ background: 'var(--bg-app)', border: '2px solid var(--border-color)', borderRadius: '8px', padding: '0.625rem 1rem', textAlign: 'center', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)' }}>IND</span>
                <span style={{ fontSize: '1.125rem', fontWeight: '800', letterSpacing: '0.08em', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                  {v.reg_number || v.id}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TN32</span>
              </div>

              {/* Specifications List */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem', marginBottom: '1.25rem', flexGrow: 1 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Model / Maker</span>
                  <strong>{v.model || v.maker || 'CNH Industrial'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Power / Fuel</span>
                  <strong>{v.hp ? `${v.hp} • ` : ''}{v.fuel_type || 'Diesel'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Chassis No.</span>
                  <strong style={{ fontSize: '0.75rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{v.chassis_number || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Engine No.</span>
                  <strong style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{v.engine_number || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Reg Date</span>
                  <strong>{formatDate(v.purchase_date)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>RC Validity</span>
                  <strong style={{ color: 'var(--success)' }}>{formatDate(v.validity_date) || '2039'}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Financer: {v.financer || 'SBI ADB'}
                </span>
                <button className="btn btn-secondary" onClick={() => handleOpenEdit(v)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                  Edit Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Add / Edit Vehicle */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{isEditing ? 'Edit Vehicle Details' : 'Register New Vehicle'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Vehicle Name *</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Case IH Austoft 4010 Maxx"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Registration Number (RC) *</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.reg_number}
                      onChange={(e) => setFormData({ ...formData, reg_number: e.target.value })}
                      placeholder="e.g. TN32BF8500"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vehicle Class / Type</label>
                    <select
                      className="form-control"
                      value={formData.vehicle_type}
                      onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    >
                      <option value="Sugarcane Harvester">Sugarcane Harvester</option>
                      <option value="Agricultural Tractor">Agricultural Tractor</option>
                      <option value="Infield Support Vehicle">Infield Support Vehicle</option>
                      <option value="Loader / Crane">Loader / Crane</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Maker / Brand</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.maker}
                      onChange={(e) => setFormData({ ...formData, maker: e.target.value })}
                      placeholder="e.g. CNH INDUSTRIAL (INDIA) PVT LTD"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Model Name</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="e.g. NH 3630 TX A1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Horse Power (HP)</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.hp}
                      onChange={(e) => setFormData({ ...formData, hp: e.target.value })}
                      placeholder="e.g. 175.54 HP or 49.5 HP"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Chassis Number</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.chassis_number}
                      onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                      placeholder="e.g. PNEY4010LR2EB0435"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Engine Number</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.engine_number}
                      onChange={(e) => setFormData({ ...formData, engine_number: e.target.value })}
                      placeholder="e.g. 002165114"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Registration</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">RC Validity Expiry</label>
                    <input 
                      type="date"
                      className="form-control"
                      value={formData.validity_date}
                      onChange={(e) => setFormData({ ...formData, validity_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Financer / Bank</label>
                    <input 
                      type="text"
                      className="form-control"
                      value={formData.financer}
                      onChange={(e) => setFormData({ ...formData, financer: e.target.value })}
                      placeholder="e.g. STATE BANK OF INDIA ADB"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Update Vehicle' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
