test('Header component renders correctly', () => {
	const { getByText } = render(<Header title="Test Title" />);
	expect(getByText('Test Title')).toBeInTheDocument();
});

test('Header component has correct functionality', () => {
	const { getByRole } = render(<Header />);
	const button = getByRole('button');
	fireEvent.click(button);
	expect(someFunction).toHaveBeenCalled();
});