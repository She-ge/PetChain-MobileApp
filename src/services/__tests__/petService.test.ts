const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  },
}));

const mockParseQRCodeData = jest.fn();
jest.mock('../qrCodeService', () => ({
  parseQRCodeData: (...args: unknown[]) => mockParseQRCodeData(...args),
}));

import {
  getAllPets,
  getPetById,
  getPetByQRCode,
  createPet,
  updatePet,
  deletePet,
  PetServiceError,
} from '../petService';

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

  it('getPetByQRCode uses QR endpoint for scan data', async () => {
    mockGet.mockResolvedValueOnce({ data: { success: true, data: PET } });

    const result = await getPetByQRCode('scanned-qr-value');

    expect(mockGet).toHaveBeenCalledWith('/pets/qr/scanned-qr-value');
    expect(result).toEqual(PET);
  });

  it('getPetByQRCode falls back to petId extraction on 404', async () => {
    const notFoundError = {
      isAxiosError: true,
      message: 'Not Found',
      response: { status: 404, data: { message: 'Not found' } },
    };

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
    const badRequestError = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 400,
        data: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Name is required',
          },
        },
      },
    };

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
