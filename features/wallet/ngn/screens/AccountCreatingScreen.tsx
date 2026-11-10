/** tVa stage 'creating' for NGN. */
export function AccountCreatingScreen() {
  return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Creating your NGN account</div>
      <p className="step-sub">This usually takes a few seconds.</p>
    </div>
  );
}
