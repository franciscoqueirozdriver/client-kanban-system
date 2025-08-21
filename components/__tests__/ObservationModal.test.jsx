/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ObservationModal from '../ObservationModal';

describe('ObservationModal', () => {
  test('clears input when reopened', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ObservationModal open={false} />);

    await act(async () => {
      rerender(<ObservationModal open={true} />);
    });
    const textarea = screen.getByRole('textbox');

    await act(async () => {
      await user.type(textarea, 'note');
    });
    expect(textarea.value).toBe('note');

    await act(async () => {
      rerender(<ObservationModal open={false} />);
    });
    await act(async () => {
      rerender(<ObservationModal open={true} />);
    });

    expect(screen.getByRole('textbox').value).toBe('');
  });

  test('cancel clears input and calls onClose', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<ObservationModal open={true} onClose={onClose} />);

    const textarea = screen.getByRole('textbox');
    await act(async () => {
      await user.type(textarea, 'something');
    });
    await act(async () => {
      await user.click(screen.getByText('Cancelar'));
    });

    expect(textarea.value).toBe('');
    expect(onClose).toHaveBeenCalled();
  });
});

