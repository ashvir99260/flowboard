export async function selectAutocomplete(input, label) {
  const combobox = input.and(input.page().getByRole('combobox'));
  await combobox.click();
  await combobox.fill(label);
  await input.page().getByRole('option', { name: label, exact: true }).click();
}
