import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import Box from '@mui/material/Box'

type BrandMarkProps = {
  size?: 'small' | 'large'
}

const BRAND_MARK_SIZES = {
  small: { box: 44, icon: 24, accent: 8 },
  large: { box: 68, icon: 36, accent: 12 },
} as const

export function BrandMark({ size = 'small' }: BrandMarkProps) {
  const dimensions = BRAND_MARK_SIZES[size]

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flex: '0 0 auto',
        alignItems: 'center',
        justifyContent: 'center',
        width: dimensions.box,
        height: dimensions.box,
        borderRadius: size === 'large' ? 3.5 : 2.5,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        boxShadow: '0 10px 24px rgba(29, 91, 82, 0.18)',
      }}
    >
      <ReceiptLongRoundedIcon sx={{ fontSize: dimensions.icon }} />
      <Box
        sx={{
          position: 'absolute',
          right: size === 'large' ? 10 : 7,
          bottom: size === 'large' ? 10 : 7,
          width: dimensions.accent,
          height: dimensions.accent,
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: '50%',
          bgcolor: 'secondary.main',
        }}
      />
    </Box>
  )
}
