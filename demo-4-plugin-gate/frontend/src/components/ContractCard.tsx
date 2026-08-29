import type { ContractField } from "../api.js";

export function ContractCard({ fields }: { fields: ContractField[] }) {
  return (
    <section className="card rail-card">
      <h2 className="rail-title">The contract</h2>
      <p className="rail-note">
        A plugin is installable only if something in it answers every row below, at exactly
        this type.
      </p>
      <table className="contract">
        <tbody>
          {fields.map((field) => (
            <tr key={field.name}>
              <td className="contract-name">{field.name}</td>
              <td className="contract-type">{field.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rail-note rail-note-quiet">
        Everything else a plugin declares is its own business — Digest never sees those names
        until install time.
      </p>
    </section>
  );
}
