import React from 'react';
import { render } from '@testing-library/react';
import Footer from '../../components/Footer';

test('renders Footer component', () => {
  const { getByText } = render(<Footer />);
  const linkElement = getByText(/footer content/i);
  expect(linkElement).toBeInTheDocument();
});