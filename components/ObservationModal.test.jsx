/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import ObservationModal from './ObservationModal';

test('clears obs when opened and when cancelling', () => {
  const handleClose = jest.fn();
  const { rerender } = render(<ObservationModal open={false} onClose={handleClose} />);

  // open modal first time
  rerender(<ObservationModal open={true} onClose={handleClose} />);
  const textarea = screen.getByRole('textbox');
  fireEvent.change(textarea, { target: { value: 'test' } });

  // cancel should clear value and call onClose
  fireEvent.click(screen.getByText('Cancelar'));
  expect(handleClose).toHaveBeenCalled();
  expect(screen.getByRole('textbox').value).toBe('');

  // close and reopen modal to ensure textarea resets
  rerender(<ObservationModal open={false} onClose={handleClose} />);
  rerender(<ObservationModal open={true} onClose={handleClose} />);
  const textareaAgain = screen.getByRole('textbox');
  expect(textareaAgain.value).toBe('');
});
