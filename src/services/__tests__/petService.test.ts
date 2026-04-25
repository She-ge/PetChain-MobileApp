jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../utils/imageUtils', () => ({
  pickImage: jest.fn(),
  compressImage: jest.fn(),
  generateThumbnail: jest.fn(),
  uploadToStorage: jest.fn(),
}));

jest.mock('../qrCodeService', () => ({
  parseQRCodeData: jest.fn(),
}));

import { AxiosError } from 'axios';
import apiClient from '../apiClient';
import { parseQRCodeData } from '../qrCodeService';
import {
  getAllPets,
  getPetById,
  getPetByQRCode,
  createPet,
  updatePet,
  deletePet,
  PetServiceError,
} from '../petService';

const mockClient = jest.mocked(apiClient);
const mockGet = mockClient.get as jest.Mock;
const mockPost = mockClient.post as jest.Mock;
const mockPut = mockClient.put as jest.Mock;
const mockDelete = mockClient.delete as jest.Mock;
const mockParseQRCodeData = parseQRCodeData as jest.Mock;

function makeAxiosError(status: number, data: unknown, message = 'Request failed') {
  const err = new Error(message) as any;
  err.isAxiosError = true;
  err.response = { status, statusText: String(status), headers: {}, config: {}, data };
  return err;
}

const PET = {
  id: 'pet-1',
  name: 'Milo',
  species: 'dog',
  ownerId: 'owner-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('petService', () => {
  it('getAllPets returns payload data when API is wrapped', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: [PET] } });

    const result = await getAllPets();

    expect(mockGet).toHaveBeenCalledWith('/pets');
    expect(result).toEqual([PET]);
  });

  it('getPetById returns unwrapped pet', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: PET } });

    const result = await getPetById('pet-1');

    expect(mockGet).toHaveBeenCalledWith('/pets/pet-1');
    expect(result).toEqual(PET);
  });

  it('getPetById surfaces forbidden access as PetServiceError', async () => {
    mockGet.mockRejectedValueOnce(
      makeAxiosError(403, {
        error: {
          code: 'PET_ACCESS_DENIED',
          message: 'You do not have access to this pet',
        },
      }, 'Forbidden'),
    );

    await expect(getPetById('pet-1')).rejects.toMatchObject({
      name: 'PetServiceError',
      code: 'PET_ACCESS_DENIED',
      message: 'You do not have access to this pet',
      status: 403,
    });

    expect(mockGet).toHaveBeenCalledWith('/pets/pet-1');
  });

  it('getPetByQRCode uses QR endpoint for scan data', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: PET } });

    const result = await getPetByQRCode('scanned-qr-value');

    expect(mockGet).toHaveBeenCalledWith('/pets/qr/scanned-qr-value');
    expect(result).toEqual(PET);
  });

  it('getPetByQRCode falls back to petId extraction on 404', async () => {
    const notFoundError = makeAxiosError(404, { message: 'Not found' }, 'Not Found');

    mockGet
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValueOnce({ data: { success: true, data: PET } });

    mockParseQRCodeData.mockReturnValueOnce({ petId: 'pet-1' });

    const result = await getPetByQRCode('base64-payload-from-scanner');

    expect(mockParseQRCodeData).toHaveBeenCalledWith('base64-payload-from-scanner');
    expect(mockGet).toHaveBeenNthCalledWith(1, '/pets/qr/base64-payload-from-scanner');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/pets/pet-1');
    expect(result).toEqual(PET);
  });

  it('getPetByQRCode surfaces unauthorized access without fallback when lookup is denied', async () => {
    mockGet.mockRejectedValueOnce(
      makeAxiosError(401, {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      }, 'Unauthorized'),
    );

    await expect(getPetByQRCode('scanned-qr-value')).rejects.toMatchObject({
      name: 'PetServiceError',
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      status: 401,
    });

    expect(mockParseQRCodeData).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/pets/qr/scanned-qr-value');
  });

  it('createPet posts payload and returns typed data', async () => {
    const payload = {
      name: 'Milo',
      species: 'dog',
      ownerId: 'owner-1',
    };

    mockPost.mockResolvedValueOnce({ data: { success: true, data: PET } });

    const result = await createPet(payload);

    expect(mockPost).toHaveBeenCalledWith('/pets', payload);
    expect(result).toEqual(PET);
  });

  it('updatePet puts payload and returns typed data', async () => {
    const payload = { name: 'Milo Updated' };
    const updated = { ...PET, name: 'Milo Updated' };

    mockPut.mockResolvedValueOnce({ data: { success: true, data: updated } });

    const result = await updatePet('pet-1', payload);

    expect(mockPut).toHaveBeenCalledWith('/pets/pet-1', payload);
    expect(result).toEqual(updated);
  });

  it('deletePet calls delete endpoint', async () => {
    mockDelete.mockResolvedValueOnce({ data: null });

    await deletePet('pet-1');

    expect(mockDelete).toHaveBeenCalledWith('/pets/pet-1');
  });

  it('surfaces API errors as PetServiceError', async () => {
    const badRequestError = makeAxiosError(400, {
      error: {
        code: 'INVALID_INPUT',
        message: 'Name is required',
      },
    });

    mockPost.mockRejectedValueOnce(badRequestError);

    await expect(createPet({ name: '', species: 'dog', ownerId: 'owner-1' })).rejects.toMatchObject(
      {
        name: 'PetServiceError',
        code: 'INVALID_INPUT',
        message: 'Name is required',
        status: 400,
      },
    );
  });

  it('validates required petId arguments', async () => {
    await expect(getPetById('   ')).rejects.toBeInstanceOf(PetServiceError);
    await expect(updatePet('   ', { name: 'X' })).rejects.toBeInstanceOf(PetServiceError);
    await expect(deletePet('   ')).rejects.toBeInstanceOf(PetServiceError);
  });
});
